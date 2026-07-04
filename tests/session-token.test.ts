import { describe, expect, test } from 'vitest';
import { jwtVerify } from 'jose';
import { signSessionToken, subFingerprint } from '../lib/session-token';

const SECRET = new TextEncoder().encode('segredo-de-teste-32-caracteres!!');

describe('token de sessão', () => {
  test('fingerprint é estável e muda com o sub', () => {
    expect(subFingerprint('sub-a')).toBe(subFingerprint('sub-a'));
    expect(subFingerprint('sub-a')).not.toBe(subFingerprint('sub-b'));
    expect(subFingerprint('sub-a')).toHaveLength(16);
  });

  test('assina e verifica com payload correto', async () => {
    const token = await signSessionToken(
      { id: 'u1', nome: 'Ruan', role: 'MEMBRO' },
      'google-sub-123',
      SECRET,
      3600,
    );
    const { payload } = await jwtVerify(token, SECRET);
    expect(payload.sub).toBe('u1');
    expect(payload.nome).toBe('Ruan');
    expect(payload.role).toBe('MEMBRO');
    expect(payload.pv).toBe(subFingerprint('google-sub-123'));
    expect(payload.exp! - payload.iat!).toBe(3600);
  });
});
