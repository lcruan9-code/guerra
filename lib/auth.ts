import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { queryOne } from './db';
import { signSessionToken } from './session-token';
import type { Role, SessionUser } from './types';

const COOKIE = 'guerra_session';
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 dias — sem fricção após 1º acesso

function secret(): Uint8Array {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error('JWT_SECRET não definida.');
  return new TextEncoder().encode(s);
}

export async function createSession(user: SessionUser): Promise<void> {
  const token = await signSessionToken(user, secret(), SESSION_MAX_AGE);
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE,
  });
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export async function getSession(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    const id = String(payload.sub);
    const row = await queryOne<{ nome: string; role: Role; guild_id: string | null }>(
      'SELECT nome, role, guild_id FROM users WHERE id = $1',
      [id],
    );
    if (!row) return null;
    return { id, nome: row.nome, role: row.role, guild_id: row.guild_id ?? undefined };
  } catch {
    return null;
  }
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getSession();
  if (!user) throw new HttpError(401, 'Não autenticado.');
  return user;
}

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function toResponse(e: unknown): Response {
  if (e instanceof HttpError) return Response.json({ error: e.message }, { status: e.status });
  console.error(e);
  return Response.json({ error: 'Erro interno.' }, { status: 500 });
}
