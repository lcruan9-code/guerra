import { queryOne, newId } from './db';
import { activeDayWars } from './war-schedule';
import { getWarTimes } from './settings';
import type { WarTipo } from './types';

const DAY_MS = 24 * 60 * 60 * 1000;

export interface EventRow {
  id: string;
  tipo: WarTipo;
  data: Date;
  cancelado?: boolean;
}

// Geração lazy: garante que as guerras do dia ATIVO existem (na terça, Torre +
// Kefra). Valem o dia inteiro e resetam na virada em SP. Idempotente e à prova
// de concorrência via UNIQUE(dia, tipo) + ON CONFLICT DO NOTHING. Se TODAS as
// guerras do dia estiverem canceladas, pula para o próximo dia com guerra.
export async function ensureDayEvents(now: Date = new Date()): Promise<EventRow[]> {
  const times = await getWarTimes();
  let cursor = now;
  for (let guard = 0; guard < 12; guard++) {
    const { dia, wars } = activeDayWars(cursor, times);
    const out: EventRow[] = [];
    for (const w of wars) {
      let ev = await queryOne<EventRow>(
        'SELECT id, tipo, data, cancelado FROM events WHERE dia = $1 AND tipo = $2',
        [w.dia, w.tipo],
      );
      if (!ev) {
        await queryOne(
          `INSERT INTO events (id, tipo, data, dia) VALUES ($1, $2, $3, $4)
           ON CONFLICT (dia, tipo) DO NOTHING`,
          [newId(), w.tipo, w.dataUtc.toISOString(), w.dia],
        );
        ev = await queryOne<EventRow>(
          'SELECT id, tipo, data, cancelado FROM events WHERE dia = $1 AND tipo = $2',
          [w.dia, w.tipo],
        );
      }
      if (ev && !ev.cancelado) out.push(ev);
    }
    if (out.length) return out;
    // dia inteiro cancelado → próximo dia com guerra
    cursor = new Date(Date.parse(`${dia}T00:00:00-03:00`) + DAY_MS);
  }
  throw new Error('Não foi possível determinar as guerras do dia.');
}

export async function getEvent(id: string): Promise<EventRow | null> {
  return queryOne<EventRow>('SELECT id, tipo, data, cancelado FROM events WHERE id = $1', [id]);
}
