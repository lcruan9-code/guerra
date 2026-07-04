import { SignJWT } from 'jose';
import { createHash } from 'crypto';
import type { SessionUser } from './types';

// Fingerprint do google_sub. Vai no token como `pv`; se o google_sub do
// usuário for trocado/limpo no banco, as sessões antigas caem.
export function subFingerprint(googleSub: string): string {
  return createHash('sha256').update(googleSub).digest('hex').slice(0, 16);
}

export async function signSessionToken(
  user: SessionUser,
  googleSub: string,
  secret: Uint8Array,
  maxAgeSeconds: number,
): Promise<string> {
  return new SignJWT({ nome: user.nome, role: user.role, pv: subFingerprint(googleSub) })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${maxAgeSeconds}s`)
    .sign(secret);
}
