import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

// As senhas das contas de jogo PRECISAM ser reveladas ao dono/admin, então não dá
// para usar hash. Guardamos cifradas em repouso com AES-256-GCM. A chave vem de
// CREDS_KEY (ou fallback para JWT_SECRET) e é derivada para 32 bytes via scrypt.

const ALGO = 'aes-256-gcm';
const SALT = 'wyd-guilds-creds-v1';

let cachedKey: Buffer | null = null;
function key(): Buffer {
  if (cachedKey) return cachedKey;
  const secret = process.env.CREDS_KEY || process.env.JWT_SECRET || 'wyd-guilds-default-secret-key-32bytes';
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
  try {
    const raw = Buffer.from(token, 'base64');
    const iv = raw.subarray(0, 12);
    const tag = raw.subarray(12, 28);
    const enc = raw.subarray(28);
    const decipher = createDecipheriv(ALGO, key(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
  } catch {
    return '***';
  }
}
