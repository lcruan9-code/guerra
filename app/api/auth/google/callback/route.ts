import { cookies } from 'next/headers';
import { exchangeAndVerify } from '@/lib/google-auth';
import { upsertGoogleUser } from '@/lib/users';
import { createSession } from '@/lib/auth';

export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const jar = await cookies();
  const saved = jar.get('oauth_state')?.value;
  jar.delete('oauth_state');
  const home = process.env.APP_URL ?? url.origin;

  if (!code || !state || !saved || state !== saved) {
    return Response.redirect(`${home}/?erro=login`, 302);
  }
  try {
    const profile = await exchangeAndVerify(code);
    const user = await upsertGoogleUser(profile);
    await createSession({ id: user.id, nome: user.nome, role: user.role }, user.google_sub);
    return Response.redirect(`${home}/`, 302);
  } catch (e) {
    console.error('Callback do Google falhou:', e);
    return Response.redirect(`${home}/?erro=login`, 302);
  }
}
