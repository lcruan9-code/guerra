import { cookies } from 'next/headers';
import { randomUUID } from 'crypto';

// Identidade do "portador" no /coletar (sem login): um id aleatório por
// navegador, guardado em cookie httpOnly de longa duração.

const COOKIE = 'coletar_holder';
const MAX_AGE = 60 * 60 * 24 * 365; // 1 ano

export async function getHolderId(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(COOKIE)?.value ?? null;
}

export async function ensureHolderId(): Promise<string> {
  const jar = await cookies();
  const existing = jar.get(COOKIE)?.value;
  if (existing) return existing;
  const id = randomUUID();
  jar.set(COOKIE, id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE,
  });
  return id;
}
