import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

// As senhas das contas de jogo PRECISAM ser reveladas ao dono/admin, então não dá
// para usar hash. Guardamos cifradas em repouso com AES-256-GCM. A chave vem de
// CREDS_KEY (ou fallback para JWT_SECRET) e é derivada para 32 bytes via scrypt.
// Não há fallback literal: sem nenhuma das duas o módulo falha em vez de cifrar
// com uma chave que está em arquivo público.

const ALGO = 'aes-256-gcm';
const SALT = 'wyd-guilds-creds-v1';

let cachedKey: Buffer | null = null;
function key(): Buffer {
  if (cachedKey) return cachedKey;
  const secret = process.env.CREDS_KEY || process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('CREDS_KEY ausente (e sem JWT_SECRET para cair). Defina CREDS_KEY no ambiente.');
  }
  if (!process.env.CREDS_KEY) {
    // Local e produção compartilham o mesmo banco: JWT_SECRET divergente entre os
    // dois significa conta cifrada de um lado que não decifra do outro.
    console.warn('[crypto] CREDS_KEY não definida, usando JWT_SECRET. Defina CREDS_KEY igual nos dois ambientes.');
  }
  cachedKey = scryptSync(secret, SALT, 32);
  return cachedKey;
}

// Formato do token: base64(iv[12] | tag[16] | ciphertext)
export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, key(), iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
}

export function decrypt(token: string): string {
  // Fora do try: chave ausente é erro de configuração, não token corrompido.
  const k = key();
  try {
    const raw = Buffer.from(token, 'base64');
    const iv = raw.subarray(0, 12);
    const tag = raw.subarray(12, 28);
    const enc = raw.subarray(28);
    const decipher = createDecipheriv(ALGO, k, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
  } catch {
    return '***';
  }
}
