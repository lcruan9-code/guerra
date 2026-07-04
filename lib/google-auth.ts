import { createRemoteJWKSet, jwtVerify } from 'jose';

const GOOGLE_AUTH = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN = 'https://oauth2.googleapis.com/token';
const GOOGLE_JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} não definida.`);
  return v;
}

export function redirectUri(): string {
  return `${env('APP_URL')}/api/auth/google/callback`;
}

export function buildAuthUrl(state: string, clientId: string, redirect: string): string {
  const p = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirect,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    prompt: 'select_account',
  });
  return `${GOOGLE_AUTH}?${p.toString()}`;
}

export function googleAuthUrl(state: string): string {
  return buildAuthUrl(state, env('GOOGLE_CLIENT_ID'), redirectUri());
}

export interface GoogleProfile {
  sub: string;
  email: string;
  nome: string;
}

export async function exchangeAndVerify(code: string): Promise<GoogleProfile> {
  const res = await fetch(GOOGLE_TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: env('GOOGLE_CLIENT_ID'),
      client_secret: env('GOOGLE_CLIENT_SECRET'),
      redirect_uri: redirectUri(),
      grant_type: 'authorization_code',
    }),
  });
  if (!res.ok) throw new Error(`Endpoint de token do Google: HTTP ${res.status}`);
  const data = (await res.json()) as { id_token?: string };
  if (!data.id_token) throw new Error('Resposta do Google sem id_token.');

  const { payload } = await jwtVerify(data.id_token, GOOGLE_JWKS, {
    issuer: ['https://accounts.google.com', 'accounts.google.com'],
    audience: env('GOOGLE_CLIENT_ID'),
  });
  const sub = String(payload.sub);
  const email = String(payload.email ?? '');
  if (!email) throw new Error('id_token sem e-mail.');
  const nome = String(payload.name ?? email.split('@')[0]);
  return { sub, email, nome };
}
