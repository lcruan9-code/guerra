import { queryOne, newId } from './db';
import { computeActiveWar } from './war-schedule';
import { getWarTimes } from './settings';
import type { WarTipo } from './types';

const DAY_MS = 24 * 60 * 60 * 1000;

export interface EventRow {
  id: string;
  tipo: WarTipo;
  data: Date;
  cancelado?: boolean;
}

// Geração lazy: garante que a guerra ATIVA do dia existe (vale o dia inteiro,
// reseta na virada em SP). Idempotente e à prova de concorrência via UNIQUE(dia)
// + ON CONFLICT DO NOTHING. Se o dia estiver cancelado pelo admin, pula para o
// próximo dia com guerra.
export async function ensureNextEvent(now: Date = new Date()): Promise<EventRow> {
  const times = await getWarTimes();
  let cursor = now;
  for (let guard = 0; guard < 12; guard++) {
    const active = computeActiveWar(cursor, times);
    const existing = await queryOne<EventRow>(
      'SELECT id, tipo, data, cancelado FROM events WHERE dia = $1',
      [active.dia],
    );
    if (existing?.cancelado) {
      // pula para o início (00:00 SP) do dia seguinte e recalcula
      cursor = new Date(Date.parse(`${active.dia}T00:00:00-03:00`) + DAY_MS);
      continue;
    }
    if (existing) return existing;
    await queryOne(
      `INSERT INTO events (id, tipo, data, dia) VALUES ($1, $2, $3, $4)
       ON CONFLICT (dia) DO NOTHING`,
      [newId(), active.tipo, active.dataUtc.toISOString(), active.dia],
    );
    const row = await queryOne<EventRow>('SELECT id, tipo, data, cancelado FROM events WHERE dia = $1', [active.dia]);
    if (row) return row;
  }
  throw new Error('Não foi possível determinar a guerra ativa.');
}

export async function getEvent(id: string): Promise<EventRow | null> {
  return queryOne<EventRow>('SELECT id, tipo, data, cancelado FROM events WHERE id = $1', [id]);
}
