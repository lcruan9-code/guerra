import { query, queryOne, newId } from './db';
import { activeDayWars, warDateUtc, warEndUtc } from './war-schedule';
import { getWarTimes, getWarDurations, getWarDowOverrides } from './settings';
import type { WarTipo } from './types';

const DAY_MS = 24 * 60 * 60 * 1000;
const SELECT_COLS = 'id, tipo, data, cancelado, fim, encerrado_em';

export interface EventRow {
  id: string;
  tipo: WarTipo;
  data: Date;
  cancelado?: boolean;
  fim?: Date | null; // fim programado (início + duração)
  encerrado_em?: Date | null; // fim manual do líder ("Kefra morto")
}

// Guerra encerrada = o líder finalizou OU o fim programado já passou.
export function isEventEnded(ev: EventRow, now: Date = new Date()): boolean {
  if (ev.encerrado_em) return true;
  if (ev.fim && now >= new Date(ev.fim)) return true;
  return false;
}

// Geração lazy: garante que as guerras do dia ATIVO existem (na terça, Torre +
// Kefra). Valem o dia inteiro e resetam na virada em SP. Idempotente e à prova
// de concorrência via UNIQUE(dia, tipo) + ON CONFLICT DO NOTHING. Se TODAS as
// guerras do dia estiverem canceladas, pula para o próximo dia com guerra.
export async function ensureDayEvents(now: Date = new Date()): Promise<EventRow[]> {
  const [times, durs, byDow] = await Promise.all([getWarTimes(), getWarDurations(), getWarDowOverrides()]);
  let cursor = now;
  for (let guard = 0; guard < 12; guard++) {
    const { dia, wars } = activeDayWars(cursor, times, durs, byDow);
    const out: EventRow[] = [];
    for (const w of wars) {
      let ev = await queryOne<EventRow>(
        `SELECT ${SELECT_COLS} FROM events WHERE dia = $1 AND tipo = $2`,
        [w.dia, w.tipo],
      );
      if (!ev) {
        await queryOne(
          `INSERT INTO events (id, tipo, data, dia, fim) VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (dia, tipo) DO NOTHING`,
          [newId(), w.tipo, w.dataUtc.toISOString(), w.dia, w.fimUtc.toISOString()],
        );
        ev = await queryOne<EventRow>(
          `SELECT ${SELECT_COLS} FROM events WHERE dia = $1 AND tipo = $2`,
          [w.dia, w.tipo],
        );
      }
      if (ev && !ev.cancelado) out.push(ev);
    }
    // Mostra o dia enquanto tiver ao menos uma guerra ainda não encerrada.
    // Se todas já acabaram (ou foram canceladas), abre o próximo dia com guerra.
    if (out.some((ev) => !isEventEnded(ev, now))) return out;
    cursor = new Date(Date.parse(`${dia}T00:00:00-03:00`) + DAY_MS);
  }
  throw new Error('Não foi possível determinar as guerras do dia.');
}

export async function getEvent(id: string): Promise<EventRow | null> {
  return queryOne<EventRow>(`SELECT ${SELECT_COLS} FROM events WHERE id = $1`, [id]);
}

// "Kefra morto" / encerrar guerra: marca o fim manual (idempotente).
export async function finalizeEvent(id: string): Promise<void> {
  await queryOne('UPDATE events SET encerrado_em = now() WHERE id = $1 AND encerrado_em IS NULL', [id]);
}

// Realinha as guerras AINDA NÃO iniciadas ao horário atual (base + override do dia
// + duração). Chamado ao salvar horários no painel, pra a mudança valer nas guerras
// já criadas — não só nas futuras. Não mexe em guerra em andamento/passada.
export async function resyncFutureEvents(): Promise<void> {
  const [times, durs, byDow] = await Promise.all([getWarTimes(), getWarDurations(), getWarDowOverrides()]);
  const rows = await query<{ id: string; tipo: WarTipo; dia: string }>(
    "SELECT id, tipo, to_char(dia,'YYYY-MM-DD') AS dia FROM events WHERE data > now() AND cancelado = false",
  );
  for (const r of rows) {
    if (r.tipo !== 'TORRE' && r.tipo !== 'KEFRA') continue;
    const dow = new Date(`${r.dia}T00:00:00Z`).getUTCDay();
    const time = byDow[dow]?.[r.tipo] ?? times[r.tipo];
    const data = warDateUtc(r.dia, time);
    const fim = warEndUtc(data, durs[r.tipo]);
    await queryOne('UPDATE events SET data = $2, fim = $3 WHERE id = $1', [r.id, data.toISOString(), fim.toISOString()]);
  }
}
