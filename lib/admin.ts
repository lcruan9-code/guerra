import { query, queryOne } from './db';
import { HttpError } from './auth';
import { ensureNextEvent, getEvent, type EventRow } from './events';
import { getWarTimes } from './settings';
import { listAwards, getWeekMeta, type AwardKey } from './rankings';

const VALID_TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const VALID_DATE = /^\d{4}-\d{2}-\d{2}$/;
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

async function getRoster(eventId: string): Promise<RosterEntry[]> {
  return query<RosterEntry>(
    `SELECT c.user_id AS "userId", u.nome, c.status, c.participou, c.ks, c.kefra,
            ch.nome AS personagem, ch.classe
     FROM confirmations c
     JOIN users u ON u.id = c.user_id
     LEFT JOIN characters ch ON ch.id = c.character_id
     WHERE c.event_id = $1
     ORDER BY c.status, u.nome`,
    [eventId],
  );
}

export interface AdminOverview {
  warTimes: { TORRE: string; NOATUM: string };
  week: { inicio: string; fim: string; texto: string };
  awards: Awaited<ReturnType<typeof listAwards>>;
  nextEvent: { id: string; tipo: string; dataIso: string; cancelado: boolean };
  roster: RosterEntry[];
  players: Array<{ userId: string; nome: string; role: string; pontos: number; presencas: number }>;
}

export async function getAdminOverview(): Promise<AdminOverview> {
  const [warTimes, week, awards, event] = await Promise.all([
    getWarTimes(),
    getWeekMeta(),
    listAwards(),
    ensureNextEvent(),
  ]);
  const roster = await getRoster(event.id);
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

export async function updateWarTimes(torre?: string, noatum?: string): Promise<void> {
  if (torre !== undefined) {
    if (!VALID_TIME.test(torre)) throw new HttpError(400, 'Horário da Torre inválido (use HH:MM).');
    await setSetting('war_time_torre', torre);
  }
  if (noatum !== undefined) {
    if (!VALID_TIME.test(noatum)) throw new HttpError(400, 'Horário da Noatum inválido (use HH:MM).');
    await setSetting('war_time_noatum', noatum);
  }
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
    await queryOne('UPDATE events SET data = $2 WHERE id = $1', [eventId, d.toISOString()]);
  } else {
    throw new HttpError(400, 'Ação inválida.');
  }
}

// Lançamento de participação + KS + Kefra pelo admin (sem trava de horário).
export async function setPlayerStats(
  eventId: string,
  userId: string,
  patch: { participou?: boolean; ks?: number; kefra?: number },
): Promise<void> {
  const sets: string[] = [];
  const params: unknown[] = [eventId, userId];
  if (patch.participou !== undefined) {
    params.push(patch.participou);
    sets.push(`participou = $${params.length}`);
  }
  if (patch.ks !== undefined) {
    if (!Number.isInteger(patch.ks) || patch.ks < 0) throw new HttpError(400, 'KS inválido.');
    params.push(patch.ks);
    sets.push(`ks = $${params.length}`);
  }
  if (patch.kefra !== undefined) {
    if (!Number.isInteger(patch.kefra) || patch.kefra < 0) throw new HttpError(400, 'Kefra inválido.');
    params.push(patch.kefra);
    sets.push(`kefra = $${params.length}`);
  }
  if (sets.length === 0) return;
  const row = await queryOne(
    `UPDATE confirmations SET ${sets.join(', ')} WHERE event_id = $1 AND user_id = $2 RETURNING id`,
    params,
  );
  if (!row) throw new HttpError(404, 'Jogador não confirmou presença nesta guerra.');
}

export type { EventRow };
