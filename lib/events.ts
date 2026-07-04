import { queryOne, newId } from './db';
import { computeNextWar } from './war-schedule';
import { getWarTimes } from './settings';
import type { WarTipo } from './types';

export interface EventRow {
  id: string;
  tipo: WarTipo;
  data: Date;
  cancelado?: boolean;
}

// Geração lazy: garante que a próxima guerra (não cancelada) existe. Idempotente
// e à prova de concorrência via UNIQUE(dia) + ON CONFLICT DO NOTHING. Se o dia
// calculado estiver cancelado pelo admin, avança para a guerra seguinte.
export async function ensureNextEvent(now: Date = new Date()): Promise<EventRow> {
  const times = await getWarTimes();
  let cursor = now;
  for (let guard = 0; guard < 12; guard++) {
    const next = computeNextWar(cursor, times);
    const existing = await queryOne<EventRow>(
      'SELECT id, tipo, data, cancelado FROM events WHERE dia = $1',
      [next.dia],
    );
    if (existing?.cancelado) {
      cursor = new Date(next.dataUtc.getTime() + 1000); // pula a guerra cancelada
      continue;
    }
    if (existing) return existing;
    await queryOne(
      `INSERT INTO events (id, tipo, data, dia) VALUES ($1, $2, $3, $4)
       ON CONFLICT (dia) DO NOTHING`,
      [newId(), next.tipo, next.dataUtc.toISOString(), next.dia],
    );
    const row = await queryOne<EventRow>('SELECT id, tipo, data, cancelado FROM events WHERE dia = $1', [next.dia]);
    if (row) return row;
  }
  throw new Error('Não foi possível determinar a próxima guerra.');
}

export async function getEvent(id: string): Promise<EventRow | null> {
  return queryOne<EventRow>('SELECT id, tipo, data, cancelado FROM events WHERE id = $1', [id]);
}
