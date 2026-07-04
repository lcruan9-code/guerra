import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { queryOne } from './db';
import { signSessionToken, subFingerprint } from './session-token';
import type { Role, SessionUser } from './types';

const COOKIE = 'guerra_session';
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 dias — sem fricção após 1º acesso

function secret(): Uint8Array {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error('JWT_SECRET não definida.');
  return new TextEncoder().encode(s);
}

export async function createSession(user: SessionUser, googleSub: string): Promise<void> {
  const token = await signSessionToken(user, googleSub, secret(), SESSION_MAX_AGE);
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
    const row = await queryOne<{ google_sub: string; nome: string; role: Role }>(
      'SELECT google_sub, nome, role FROM users WHERE id = $1',
      [id],
    );
    if (!row) return null;
    if (payload.pv !== subFingerprint(row.google_sub)) return null; // sub trocado → sessão cai
    return { id, nome: row.nome, role: row.role };
  } catch {
    return null;
  }
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getSession();
  if (!user) throw new HttpError(401, 'Não autenticado.');
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== 'ADMIN') throw new HttpError(403, 'Acesso restrito ao líder.');
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
