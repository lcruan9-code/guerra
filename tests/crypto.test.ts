import { afterEach, describe, expect, test, vi } from 'vitest';

// A chave é derivada uma vez e fica em cache no módulo, então cada caso recarrega
// lib/crypto com o ambiente que quer exercitar.
async function loadCrypto(env: Record<string, string | undefined>) {
  vi.resetModules();
  for (const [k, v] of Object.entries(env)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  return import('../lib/crypto');
}

const ORIGINAL = { CREDS_KEY: process.env.CREDS_KEY, JWT_SECRET: process.env.JWT_SECRET };

afterEach(() => {
  for (const [k, v] of Object.entries(ORIGINAL)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});

describe('cifragem das credenciais de conta', () => {
  test('ida e volta devolve o texto original', async () => {
    const { encrypt, decrypt } = await loadCrypto({ CREDS_KEY: 'chave-de-teste-1', JWT_SECRET: undefined });
    const senha = 'senha-do-jogo-123';
    expect(decrypt(encrypt(senha))).toBe(senha);
  });

  test('cada cifragem gera token diferente (IV aleatório)', async () => {
    const { encrypt } = await loadCrypto({ CREDS_KEY: 'chave-de-teste-1', JWT_SECRET: undefined });
    expect(encrypt('igual')).not.toBe(encrypt('igual'));
  });

  test('token adulterado não decifra', async () => {
    const { encrypt, decrypt } = await loadCrypto({ CREDS_KEY: 'chave-de-teste-1', JWT_SECRET: undefined });
    const raw = Buffer.from(encrypt('senha'), 'base64');
    raw[raw.length - 1] ^= 0xff;
    expect(decrypt(raw.toString('base64'))).toBe('***');
  });

  test('chave diferente não decifra o que a outra cifrou', async () => {
    const a = await loadCrypto({ CREDS_KEY: 'chave-A', JWT_SECRET: undefined });
    const token = a.encrypt('senha');
    const b = await loadCrypto({ CREDS_KEY: 'chave-B', JWT_SECRET: undefined });
    expect(b.decrypt(token)).toBe('***');
  });

  test('sem CREDS_KEY cai no JWT_SECRET', async () => {
    const { encrypt, decrypt } = await loadCrypto({ CREDS_KEY: undefined, JWT_SECRET: 'segredo-jwt' });
    expect(decrypt(encrypt('senha'))).toBe('senha');
  });

  test('sem nenhuma das duas, falha em vez de usar chave literal', async () => {
    const { encrypt, decrypt } = await loadCrypto({ CREDS_KEY: undefined, JWT_SECRET: undefined });
    expect(() => encrypt('senha')).toThrow(/CREDS_KEY/);
    expect(() => decrypt('qualquer-coisa')).toThrow(/CREDS_KEY/);
  });
});
