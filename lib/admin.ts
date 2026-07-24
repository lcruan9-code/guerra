import { query, queryOne, withTransaction } from './db';
import { HttpError } from './auth';
import { ensureDayEvents, getEvent, resyncFutureEvents, type EventRow } from './events';
import { getWarTimes, getWarDurations, getWarDowOverrides } from './settings';
import { listAwards, getWeekMeta, type AwardKey } from './rankings';
import { gearScore, slotBreakdown, type SlotScore } from './gear';
import type { Equipment } from './types';

const VALID_TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const VALID_DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_DUR = 180;
const AWARD_KEYS: AwardKey[] = ['PONTOS', 'KS_TORRE', 'KEFRA', 'PARTICIPACAO'];

async function setSetting(key: string, value: string): Promise<void> {
  await queryOne(
    `INSERT INTO settings (key, value) VALUES ($1, $2)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [key, value],
  );
}

export interface RosterEntry {
  userId: string;
  nome: string;
  status: 'VOU' | 'NAO_VOU' | 'TALVEZ';
  personagem: string | null;
  classe: string | null;
  participou: boolean | null;
  ks: number;
  kefra: number;
}

// Teto de KS por guerra: Torre = 3 (Kill Steals no dia), Kefra = 1 (na semana).
export function ksCapForTipo(tipo: string): number {
  return tipo === 'KEFRA' ? 1 : 3;
}
export function ksLabelForTipo(tipo: string): 'KS' | 'Kefra' {
  return tipo === 'KEFRA' ? 'Kefra' : 'KS';
}

export interface RosterView {
  ksLabel: 'KS' | 'Kefra';
  ksCap: number;
  ksTotal: number;
  roster: RosterEntry[];
}

export async function getRosterView(eventId: string): Promise<RosterView> {
  const ev = await queryOne<{ tipo: string }>('SELECT tipo FROM events WHERE id = $1', [eventId]);
  if (!ev) throw new HttpError(404, 'Guerra não encontrada.');
  const roster = await query<RosterEntry>(
    `SELECT c.user_id AS "userId", u.nome, c.status, c.participou, c.ks, c.kefra,
            ch.nome AS personagem, ch.classe
     FROM confirmations c
     JOIN users u ON u.id = c.user_id
     LEFT JOIN characters ch ON ch.id = c.character_id
     WHERE c.event_id = $1
     ORDER BY c.status, u.nome`,
    [eventId],
  );
  const ksTotal = roster.reduce((s, r) => s + (r.ks ?? 0), 0);
  return { ksLabel: ksLabelForTipo(ev.tipo), ksCap: ksCapForTipo(ev.tipo), ksTotal, roster };
}

// Visão por DIA: junta as guerras do dia (Torre e, na terça, Kefra) numa tabela só.
export interface DayWarInfo {
  id: string;
  tipo: string;
  ksLabel: 'KS' | 'Kefra';
  ksCap: number;
  ksTotal: number;
}
export interface DayRow {
  userId: string;
  nome: string;
  personagem: string | null;
  classe: string | null;
  cells: Record<string, { participou: boolean | null; ks: number }>; // por eventId
}
export interface DayView {
  dia: string;
  wars: DayWarInfo[];
  rows: DayRow[];
}

export async function getDayView(dia: string): Promise<DayView> {
  const evs = await query<{ id: string; tipo: string }>(
    `SELECT id, tipo FROM events WHERE dia = $1
     ORDER BY (CASE tipo WHEN 'TORRE' THEN 0 WHEN 'KEFRA' THEN 1 ELSE 2 END)`,
    [dia],
  );
  const wars: DayWarInfo[] = [];
  const byUser = new Map<string, DayRow>();

  for (const ev of evs) {
    const rows = await query<{
      userId: string;
      nome: string;
      personagem: string | null;
      classe: string | null;
      participou: boolean | null;
      ks: number;
    }>(
      `SELECT c.user_id AS "userId", u.nome, c.participou, c.ks, ch.nome AS personagem, ch.classe
       FROM confirmations c
       JOIN users u ON u.id = c.user_id
       LEFT JOIN characters ch ON ch.id = c.character_id
       WHERE c.event_id = $1 AND c.status = 'VOU'
       ORDER BY u.nome`,
      [ev.id],
    );
    const ksTotal = rows.reduce((s, r) => s + (r.ks ?? 0), 0);
    wars.push({ id: ev.id, tipo: ev.tipo, ksLabel: ksLabelForTipo(ev.tipo), ksCap: ksCapForTipo(ev.tipo), ksTotal });
    for (const r of rows) {
      let row = byUser.get(r.userId);
      if (!row) {
        row = { userId: r.userId, nome: r.nome, personagem: r.personagem, classe: r.classe, cells: {} };
        byUser.set(r.userId, row);
      }
      if (!row.personagem && r.personagem) {
        row.personagem = r.personagem;
        row.classe = r.classe;
      }
      row.cells[ev.id] = { participou: r.participou, ks: r.ks ?? 0 };
    }
  }

  const rows = [...byUser.values()].sort((a, b) => a.nome.localeCompare(b.nome));
  return { dia, wars, rows };
}

// Define quantos KS o jogador deu nesta guerra, respeitando o teto por guerra.
export async function setKs(eventId: string, userId: string, value: number): Promise<void> {
  if (!Number.isInteger(value) || value < 0) throw new HttpError(400, 'Valor de KS inválido.');
  await withTransaction(async (q) => {
    const evRows = await q<{ tipo: string }>('SELECT tipo FROM events WHERE id = $1', [eventId]);
    if (!evRows[0]) throw new HttpError(404, 'Guerra não encontrada.');
    const cap = ksCapForTipo(evRows[0].tipo);
    const label = ksLabelForTipo(evRows[0].tipo);
    if (value > cap) throw new HttpError(400, `Cada jogador dá no máximo ${cap} ${label} nesta guerra.`);
    // Kefra (cap 1): escolha única — marcar alguém limpa quem estava marcado antes.
    if (cap === 1 && value >= 1) {
      await q('UPDATE confirmations SET ks = 0 WHERE event_id = $1 AND user_id <> $2', [eventId, userId]);
    }
    const others = await q<{ s: number }>(
      'SELECT COALESCE(SUM(ks), 0)::int AS s FROM confirmations WHERE event_id = $1 AND user_id <> $2',
      [eventId, userId],
    );
    if (others[0].s + value > cap) {
      throw new HttpError(400, `Total de ${label} por guerra é ${cap} (já há ${others[0].s} lançado(s)).`);
    }
    const upd = await q('UPDATE confirmations SET ks = $3 WHERE event_id = $1 AND user_id = $2 RETURNING id', [
      eventId,
      userId,
      value,
    ]);
    if (!upd[0]) throw new HttpError(404, 'Jogador não confirmou presença nesta guerra.');
  });
}

export interface AdminOverview {
  warTimes: { TORRE: string; KEFRA: string };
  warDurations: { TORRE: number; KEFRA: number };
  torreTerca: string; // Torre da terça (override); vazio = usa a base
  week: { inicio: string; fim: string; texto: string };
  awards: Awaited<ReturnType<typeof listAwards>>;
  nextEvent: { id: string; tipo: string; dataIso: string; cancelado: boolean };
  roster: RosterEntry[];
  players: Array<{ userId: string; nome: string; role: string; pontos: number; presencas: number }>;
}

export async function getAdminOverview(): Promise<AdminOverview> {
  const [warTimes, warDurations, byDow, week, awards, dayEvents] = await Promise.all([
    getWarTimes(),
    getWarDurations(),
    getWarDowOverrides(),
    getWeekMeta(),
    listAwards(),
    ensureDayEvents(),
  ]);
  const event = dayEvents[0];
  const { roster } = await getRosterView(event.id);
  const players = await query<{ userId: string; nome: string; role: string; pontos: number; presencas: number }>(
    `SELECT u.id AS "userId", u.nome, u.role,
            COALESCE(5 * COUNT(*) FILTER (WHERE c.status = 'VOU')
                   + 5 * COUNT(*) FILTER (WHERE c.participou IS TRUE), 0)::int AS pontos,
            COUNT(*) FILTER (WHERE c.participou IS TRUE)::int AS presencas
     FROM users u
     LEFT JOIN confirmations c ON c.user_id = u.id
     GROUP BY u.id, u.nome, u.role
     ORDER BY pontos DESC, u.nome ASC`,
  );
  return {
    warTimes,
    warDurations,
    torreTerca: byDow[2]?.TORRE ?? '',
    week,
    awards,
    nextEvent: {
      id: event.id,
      tipo: event.tipo,
      dataIso: new Date(event.data).toISOString(),
      cancelado: !!event.cancelado,
    },
    roster,
    players,
  };
}

export interface EventListItem {
  id: string;
  tipo: string;
  dia: string;
  dataIso: string;
  cancelado: boolean;
  vou: number;
  participou: number;
}

// Guerras recentes (para o líder navegar e lançar presença de guerras anteriores).
export async function listRecentEvents(limit = 16): Promise<EventListItem[]> {
  const rows = await query<{
    id: string;
    tipo: string;
    dia: string;
    data: Date;
    cancelado: boolean;
    vou: number;
    participou: number;
  }>(
    `SELECT e.id, e.tipo, to_char(e.dia, 'YYYY-MM-DD') AS dia, e.data, e.cancelado,
            COUNT(*) FILTER (WHERE c.status = 'VOU')::int AS vou,
            COUNT(*) FILTER (WHERE c.participou IS TRUE)::int AS participou
     FROM events e
     LEFT JOIN confirmations c ON c.event_id = e.id
     GROUP BY e.id
     ORDER BY e.dia DESC
     LIMIT $1`,
    [limit],
  );
  return rows.map((r) => ({
    id: r.id,
    tipo: r.tipo,
    dia: r.dia,
    dataIso: new Date(r.data).toISOString(),
    cancelado: r.cancelado,
    vou: r.vou,
    participou: r.participou,
  }));
}

export interface WarTimesInput {
  torre?: string;
  kefra?: string;
  torreTerca?: string; // Torre só da terça (dia do Kefra)
  durTorre?: number;
  durKefra?: number;
}

function validDur(v: number, label: string): void {
  if (!Number.isInteger(v) || v < 1 || v > MAX_DUR) {
    throw new HttpError(400, `Duração do ${label} inválida (1 a ${MAX_DUR} min).`);
  }
}

export async function updateWarTimes(input: WarTimesInput): Promise<void> {
  const { torre, kefra, torreTerca, durTorre, durKefra } = input;
  if (torre !== undefined) {
    if (!VALID_TIME.test(torre)) throw new HttpError(400, 'Horário da Torre inválido (use HH:MM).');
    await setSetting('war_time_torre', torre);
  }
  if (kefra !== undefined) {
    if (!VALID_TIME.test(kefra)) throw new HttpError(400, 'Horário do Kefra inválido (use HH:MM).');
    await setSetting('war_time_kefra', kefra);
  }
  if (torreTerca !== undefined) {
    if (!VALID_TIME.test(torreTerca)) throw new HttpError(400, 'Horário da Torre (terça) inválido (use HH:MM).');
    await setSetting('war_time_torre_2', torreTerca); // 2 = terça
  }
  if (durTorre !== undefined) {
    validDur(durTorre, 'Torre');
    await setSetting('war_dur_torre', String(durTorre));
  }
  if (durKefra !== undefined) {
    validDur(durKefra, 'Kefra');
    await setSetting('war_dur_kefra', String(durKefra));
  }
  // Aplica os horários novos às guerras já criadas que ainda não começaram.
  await resyncFutureEvents();
}

export async function updateWeek(inicio?: string, fim?: string, texto?: string): Promise<void> {
  if (inicio !== undefined) {
    if (inicio && !VALID_DATE.test(inicio)) throw new HttpError(400, 'Data de início inválida.');
    await setSetting('semana_inicio', inicio);
  }
  if (fim !== undefined) {
    if (fim && !VALID_DATE.test(fim)) throw new HttpError(400, 'Data de fim inválida.');
    await setSetting('semana_fim', fim);
  }
  if (texto !== undefined) await setSetting('premio_semana', texto);
}

export async function updateAward(key: string, ativo?: boolean, premio?: string): Promise<void> {
  if (!AWARD_KEYS.includes(key as AwardKey)) throw new HttpError(400, 'Prêmio inválido.');
  const sets: string[] = [];
  const params: unknown[] = [key];
  if (ativo !== undefined) {
    params.push(ativo);
    sets.push(`ativo = $${params.length}`);
  }
  if (premio !== undefined) {
    params.push(premio);
    sets.push(`premio = $${params.length}`);
  }
  if (sets.length === 0) return;
  await queryOne(`UPDATE awards SET ${sets.join(', ')} WHERE key = $1`, params);
}

export async function controlEvent(eventId: string, action: string, dataIso?: string): Promise<void> {
  const event = await getEvent(eventId);
  if (!event) throw new HttpError(404, 'Guerra não encontrada.');
  if (action === 'cancel') {
    await queryOne('UPDATE events SET cancelado = true WHERE id = $1', [eventId]);
  } else if (action === 'restore') {
    await queryOne('UPDATE events SET cancelado = false WHERE id = $1', [eventId]);
  } else if (action === 'reschedule') {
    if (!dataIso) throw new HttpError(400, 'Informe a nova data/hora.');
    const d = new Date(dataIso);
    if (Number.isNaN(d.getTime())) throw new HttpError(400, 'Data/hora inválida.');
    // Recalcula o fim a partir da duração do tipo e reabre (limpa "Kefra morto").
    const durs = await getWarDurations();
    const durMin = event.tipo === 'TORRE' || event.tipo === 'KEFRA' ? durs[event.tipo] : 20;
    const fim = new Date(d.getTime() + durMin * 60 * 1000);
    await queryOne('UPDATE events SET data = $2, fim = $3, encerrado_em = NULL WHERE id = $1', [
      eventId,
      d.toISOString(),
      fim.toISOString(),
    ]);
  } else {
    throw new HttpError(400, 'Ação inválida.');
  }
}

// Lançamento de presença (foi/não foi) pelo admin — sem trava de horário.
export async function setParticipation(
  eventId: string,
  userId: string,
  participou: boolean,
): Promise<void> {
  const row = await queryOne(
    `UPDATE confirmations SET participou = $3 WHERE event_id = $1 AND user_id = $2 RETURNING id`,
    [eventId, userId, participou],
  );
  if (!row) throw new HttpError(404, 'Jogador não confirmou presença nesta guerra.');
}

export type { EventRow };

export interface GearRankEntry {
  userNome: string;
  personagem: string;
  classe: string;
  especializacao: string;
  score: number;
  breakdown: SlotScore[];
}

// Todos os personagens ordenados por gear score (maior primeiro). Para o líder
// montar a composição da guerra.
export async function gearRanking(): Promise<GearRankEntry[]> {
  const rows = await query<{
    userNome: string; personagem: string; classe: string;
    especializacao: string; equipment: Equipment | null;
  }>(
    `SELECT u.nome AS "userNome", ch.nome AS personagem, ch.classe,
            ch.especializacao, ch.equipment
     FROM characters ch JOIN users u ON u.id = ch.user_id`,
  );
  return rows
    .map((r) => ({
      userNome: r.userNome, personagem: r.personagem, classe: r.classe,
      especializacao: r.especializacao,
      score: gearScore(r.equipment), breakdown: slotBreakdown(r.equipment),
    }))
    .sort((a, b) => b.score - a.score);
}
