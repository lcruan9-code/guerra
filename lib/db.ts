import { Pool, type QueryResultRow } from 'pg';

let pool: Pool | undefined;

export function getPool(): Pool {
  if (!pool) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL não definida.');
    pool = new Pool({ connectionString: url, max: 3 });
  }
  return pool;
}

export async function query<T extends QueryResultRow>(sql: string, params: unknown[] = []): Promise<T[]> {
  const res = await getPool().query<T>(sql, params);
  return res.rows;
}

export async function queryOne<T extends QueryResultRow>(sql: string, params: unknown[] = []): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows[0] ?? null;
}

type TxQuery = <T extends QueryResultRow = QueryResultRow>(sql: string, params?: unknown[]) => Promise<T[]>;

export async function withTransaction<T>(fn: (q: TxQuery) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const q: TxQuery = async (sql, params = []) => (await client.query(sql, params)).rows;
    const result = await fn(q);
    await client.query('COMMIT');
    return result;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

export function newId(): string {
  return crypto.randomUUID();
}
