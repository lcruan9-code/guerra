import { queryOne, newId } from './db';
import type { Role } from './types';
import type { GoogleProfile } from './google-auth';

export interface UserRow {
  id: string;
  nome: string;
  role: Role;
  google_sub: string;
}

const RETURNING = 'RETURNING id, nome, role, google_sub';

export async function upsertGoogleUser(p: GoogleProfile): Promise<UserRow> {
  try {
    const row = await queryOne<UserRow>(
      `INSERT INTO users (id, google_sub, email, nome)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (google_sub) DO UPDATE SET email = EXCLUDED.email, nome = EXCLUDED.nome
       ${RETURNING}`,
      [newId(), p.sub, p.email, p.nome],
    );
    return row!;
  } catch (e) {
    // Conflito no e-mail (conta Google recriada com novo sub): reatribui o sub.
    if ((e as { code?: string }).code === '23505') {
      const row = await queryOne<UserRow>(
        `UPDATE users SET google_sub = $1, nome = $2 WHERE email = $3 ${RETURNING}`,
        [p.sub, p.nome, p.email],
      );
      if (row) return row;
    }
    throw e;
  }
}
