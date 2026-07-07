import { SignJWT } from 'jose';
import type { SessionUser } from './types';

// Token de sessão sem provedor externo: a identidade vive no cookie do
// navegador (30 dias). O `sub` é o id do usuário criado no 1º cadastro.
export async function signSessionToken(
  user: SessionUser,
  secret: Uint8Array,
  maxAgeSeconds: number,
): Promise<string> {
  return new SignJWT({ nome: user.nome, role: user.role })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${maxAgeSeconds}s`)
    .sign(secret);
}
