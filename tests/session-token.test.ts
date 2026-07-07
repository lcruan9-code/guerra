import { describe, expect, test } from 'vitest';
import { jwtVerify } from 'jose';
import { signSessionToken } from '../lib/session-token';

const SECRET = new TextEncoder().encode('segredo-de-teste-32-caracteres!!');

describe('token de sessão', () => {
  test('assina e verifica com payload correto', async () => {
    const token = await signSessionToken({ id: 'u1', nome: 'Ruan', role: 'MEMBRO' }, SECRET, 3600);
    const { payload } = await jwtVerify(token, SECRET);
    expect(payload.sub).toBe('u1');
    expect(payload.nome).toBe('Ruan');
    expect(payload.role).toBe('MEMBRO');
    expect(payload.exp! - payload.iat!).toBe(3600);
  });
});
