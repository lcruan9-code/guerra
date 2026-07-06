import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';
import { scryptSync, randomBytes, timingSafeEqual, createHash } from 'crypto';
import { queryOne } from './db';
import { HttpError, requireUser } from './auth';
import type { SessionUser } from './types';

const COOKIE = 'guerra_lider';
const MAX_AGE = 60 * 60 * 3; // 3 horas — depois pede a senha de novo
const KEY = 'lider_senha_hash';
const DEFAULT_SENHA = 'wyd2026';

function secret(): Uint8Array {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error('JWT_SECRET não definida.');
  return new TextEncoder().encode(s);
}

function makeHash(senha: string): string {
  const salt = randomBytes(16).toString('hex');
  const dk = scryptSync(senha, salt, 32).toString('hex');
  return `${salt}$${dk}`;
}

function checkHash(senha: string, stored: string): boolean {
  const [salt, dk] = stored.split('$');
  if (!salt || !dk) return false;
  const calc = scryptSync(senha, salt, 32);
  const expected = Buffer.from(dk, 'hex');
  return expected.length === calc.length && timingSafeEqual(expected, calc);
}

// Muda quando a senha muda → derruba cookies antigos de líder.
function fingerprint(stored: string): string {
  return createHash('sha256').update(stored).digest('hex').slice(0, 16);
}

async function getOrSeedHash(): Promise<string> {
  const row = await queryOne<{ value: string }>('SELECT value FROM settings WHERE key = $1', [KEY]);
  if (row) return row.value;
  await queryOne(
    `INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING`,
    [KEY, makeHash(DEFAULT_SENHA)],
  );
  const seeded = await queryOne<{ value: string }>('SELECT value FROM settings WHERE key = $1', [KEY]);
  return seeded!.value;
}

async function grant(hash: string): Promise<void> {
  const token = await new SignJWT({ lv: fingerprint(hash) })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret());
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE,
  });
}

export async function unlockLeader(senha: string): Promise<void> {
  const hash = await getOrSeedHash();
  if (!checkHash(senha ?? '', hash)) throw new HttpError(401, 'Senha do líder incorreta.');
  await grant(hash);
}

export async function changeLeaderPassword(nova: string): Promise<void> {
  const s = (nova ?? '').trim();
  if (s.length < 4) throw new HttpError(400, 'A nova senha deve ter ao menos 4 caracteres.');
  const hash = makeHash(s);
  await queryOne(
    `INSERT INTO settings (key, value) VALUES ($1, $2)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [KEY, hash],
  );
  await grant(hash); // mantém quem trocou; os demais cookies caem (fingerprint mudou)
}

export async function lockLeader(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export async function hasLeaderAccess(): Promise<boolean> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, secret());
    const hash = await getOrSeedHash();
    return payload.lv === fingerprint(hash);
  } catch {
    return false;
  }
}

export async function requireLeader(): Promise<SessionUser> {
  const user = await requireUser();
  if (!(await hasLeaderAccess())) throw new HttpError(403, 'LEADER_LOCKED');
  return user;
}
