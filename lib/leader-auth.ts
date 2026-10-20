import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';
import { scryptSync, randomBytes, timingSafeEqual, createHash } from 'crypto';
import { queryOne } from './db';
import { HttpError, requireUser } from './auth';
import type { SessionUser } from './types';

const DEFAULT_SENHA = 'wyd2026';
const MAX_AGE = 60 * 60 * 3; // 3 horas — depois pede a senha de novo

function secret(): Uint8Array {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error('JWT_SECRET não definida.');
  return new TextEncoder().encode(s);
}

export function makeHash(senha: string): string {
  const salt = randomBytes(16).toString('hex');
  const dk = scryptSync(senha, salt, 32).toString('hex');
  return `${salt}$${dk}`;
}

export function checkHash(senha: string, stored: string): boolean {
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

function cookieName(guildId = 'default'): string {
  return `guerra_lider_${guildId.replace(/[^a-zA-Z0-9_]/g, '_')}`;
}

async function getOrSeedHash(guildId?: string): Promise<string> {
  const gid = guildId || 'g-imperium';
  const row = await queryOne<{ leader_hash: string | null }>(
    'SELECT leader_hash FROM guilds WHERE id = $1',
    [gid],
  );
  if (row?.leader_hash) return row.leader_hash;

  const defaultHash = makeHash(DEFAULT_SENHA);
  await queryOne(
    `UPDATE guilds SET leader_hash = $1 WHERE id = $2`,
    [defaultHash, gid],
  );
  return defaultHash;
}

async function grant(hash: string, guildId = 'g-imperium'): Promise<void> {
  const token = await new SignJWT({ lv: fingerprint(hash), gid: guildId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret());
  const jar = await cookies();
  jar.set(cookieName(guildId), token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE,
  });
}

export async function unlockLeader(senha: string, guildId = 'g-imperium'): Promise<void> {
  const hash = await getOrSeedHash(guildId);
  if (!checkHash(senha ?? '', hash)) throw new HttpError(401, 'Senha do líder incorreta.');
  await grant(hash, guildId);
}

export async function changeLeaderPassword(nova: string, guildId = 'g-imperium'): Promise<void> {
  const s = (nova ?? '').trim();
  if (s.length < 4) throw new HttpError(400, 'A nova senha deve ter ao menos 4 caracteres.');
  const hash = makeHash(s);
  await queryOne(
    `UPDATE guilds SET leader_hash = $1 WHERE id = $2`,
    [hash, guildId],
  );
  await grant(hash, guildId);
}

export async function lockLeader(guildId = 'g-imperium'): Promise<void> {
  const jar = await cookies();
  jar.delete(cookieName(guildId));
}

export async function hasLeaderAccess(guildId = 'g-imperium'): Promise<boolean> {
  const jar = await cookies();
  const token = jar.get(cookieName(guildId))?.value;
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, secret());
    const hash = await getOrSeedHash(guildId);
    return payload.lv === fingerprint(hash) && payload.gid === guildId;
  } catch {
    return false;
  }
}

export async function requireLeader(guildId = 'g-imperium'): Promise<SessionUser> {
  const user = await requireUser();
  if (!(await hasLeaderAccess(guildId))) throw new HttpError(403, 'LEADER_LOCKED');
  return user;
}
