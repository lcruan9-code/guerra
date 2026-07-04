import { query, queryOne, newId } from './db';
import { HttpError } from './auth';
import { getEvent } from './events';
import { computeSummary, type Summary } from './summary';
import type { Classe, ConfirmStatus, Especializacao, ListEntry, WarListsDTO } from './types';

const STATUSES: ConfirmStatus[] = ['VOU', 'NAO_VOU', 'TALVEZ'];

async function getOpenEvent(eventId: string) {
  const event = await getEvent(eventId);
  if (!event) throw new HttpError(404, 'Guerra não encontrada.');
  return event;
}

export async function confirmPresence(
  userId: string,
  eventId: string,
  status: string,
  characterId: string | null,
): Promise<void> {
  if (!STATUSES.includes(status as ConfirmStatus)) throw new HttpError(400, 'Status inválido.');
  const event = await getOpenEvent(eventId);
  if (new Date() >= new Date(event.data)) {
    throw new HttpError(409, 'A guerra já começou — confirmações encerradas.');
  }

  let charId: string | null = null;
  if (status === 'VOU') {
    if (!characterId) throw new HttpError(400, 'Escolha um personagem para confirmar presença.');
    const owned = await queryOne('SELECT id FROM characters WHERE id = $1 AND user_id = $2', [characterId, userId]);
    if (!owned) throw new HttpError(403, 'Personagem não pertence a você.');
    charId = characterId;
  }

  await queryOne(
    `INSERT INTO confirmations (id, user_id, event_id, character_id, status)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (user_id, event_id)
     DO UPDATE SET status = EXCLUDED.status, character_id = EXCLUDED.character_id, updated_at = now()`,
    [newId(), userId, eventId, charId, status],
  );
}

export async function getMyConfirmation(userId: string, eventId: string) {
  return queryOne<{ status: ConfirmStatus; character_id: string | null }>(
    'SELECT status, character_id FROM confirmations WHERE user_id = $1 AND event_id = $2',
    [userId, eventId],
  );
}

interface ListRow {
  status: ConfirmStatus;
  user_id: string;
  nome: string;
  personagem: string | null;
  classe: string | null;
  especializacao: string | null;
  participou: boolean | null;
}

export async function getWarLists(eventId: string): Promise<WarListsDTO> {
  const rows = await query<ListRow>(
    `SELECT c.status, c.user_id, c.participou, u.nome,
            ch.nome AS personagem, ch.classe, ch.especializacao
     FROM confirmations c
     JOIN users u ON u.id = c.user_id
     LEFT JOIN characters ch ON ch.id = c.character_id
     WHERE c.event_id = $1
     ORDER BY c.updated_at`,
    [eventId],
  );
  const toEntry = (r: ListRow): ListEntry => ({
    userId: r.user_id,
    nome: r.nome,
    personagem: r.personagem,
    classe: r.classe as Classe | null,
    especializacao: r.especializacao as Especializacao | null,
    participou: r.participou,
  });
  return {
    vou: rows.filter((r) => r.status === 'VOU').map(toEntry),
    talvez: rows.filter((r) => r.status === 'TALVEZ').map(toEntry),
    nao_vou: rows.filter((r) => r.status === 'NAO_VOU').map(toEntry),
  };
}

export async function getWarSummary(eventId: string): Promise<Summary> {
  const rows = await query<{ classe: string; especializacao: string }>(
    `SELECT ch.classe, ch.especializacao
     FROM confirmations c
     JOIN characters ch ON ch.id = c.character_id
     WHERE c.event_id = $1 AND c.status = 'VOU'`,
    [eventId],
  );
  return computeSummary(rows);
}

export async function setParticipation(eventId: string, targetUserId: string, participou: boolean): Promise<void> {
  const event = await getOpenEvent(eventId);
  if (new Date() < new Date(event.data)) {
    throw new HttpError(409, 'A guerra ainda não começou — check de participação indisponível.');
  }
  const row = await queryOne(
    `UPDATE confirmations SET participou = $3
     WHERE event_id = $1 AND user_id = $2 AND status = 'VOU'
     RETURNING id`,
    [eventId, targetUserId, participou],
  );
  if (!row) throw new HttpError(404, 'Confirmação não encontrada.');
}

// Pontos derivados: +5 por confirmação VOU, +5 por participação validada.
export async function getUserPoints(userId: string): Promise<number> {
  const row = await queryOne<{ pontos: number }>(
    `SELECT (5 * COUNT(*) FILTER (WHERE status = 'VOU')
           + 5 * COUNT(*) FILTER (WHERE participou IS TRUE))::int AS pontos
     FROM confirmations WHERE user_id = $1`,
    [userId],
  );
  return row?.pontos ?? 0;
}
