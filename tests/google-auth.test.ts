import { describe, expect, test } from 'vitest';
import { buildAuthUrl } from '../lib/google-auth';

describe('buildAuthUrl', () => {
  test('monta URL do consent com todos os parâmetros', () => {
    const url = new URL(buildAuthUrl('state-xyz', 'client-123', 'http://localhost:3000/api/auth/google/callback'));
    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(url.searchParams.get('client_id')).toBe('client-123');
    expect(url.searchParams.get('redirect_uri')).toBe('http://localhost:3000/api/auth/google/callback');
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('scope')).toBe('openid email profile');
    expect(url.searchParams.get('state')).toBe('state-xyz');
  });
});
