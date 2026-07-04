import { queryOne, newId } from './db';
import { computeNextWar } from './war-schedule';
import { getWarTimes } from './settings';
import type { WarTipo } from './types';

export interface EventRow {
  id: string;
  tipo: WarTipo;
  data: Date;
}

// Geração lazy: garante que a próxima guerra existe. Idempotente e à prova de
// concorrência via UNIQUE(dia) + ON CONFLICT DO NOTHING.
export async function ensureNextEvent(now: Date = new Date()): Promise<EventRow> {
  const times = await getWarTimes();
  const next = computeNextWar(now, times);
  await queryOne(
    `INSERT INTO events (id, tipo, data, dia) VALUES ($1, $2, $3, $4)
     ON CONFLICT (dia) DO NOTHING`,
    [newId(), next.tipo, next.dataUtc.toISOString(), next.dia],
  );
  const row = await queryOne<EventRow>('SELECT id, tipo, data FROM events WHERE dia = $1', [next.dia]);
  if (!row) throw new Error('Evento não encontrado após inserção.');
  return row;
}

export async function getEvent(id: string): Promise<EventRow | null> {
  return queryOne<EventRow>('SELECT id, tipo, data FROM events WHERE id = $1', [id]);
}
