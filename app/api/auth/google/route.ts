import { cookies } from 'next/headers';
import { randomBytes } from 'crypto';
import { googleAuthUrl } from '@/lib/google-auth';

export async function GET(): Promise<Response> {
  const state = randomBytes(16).toString('hex');
  const jar = await cookies();
  jar.set('oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 600,
  });
  return Response.redirect(googleAuthUrl(state), 302);
}
