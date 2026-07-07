import { createSession, toResponse, HttpError } from '@/lib/auth';
import { loginByCharacterName } from '@/lib/characters';

// Login sem senha: entra pelo nome do personagem. 404 se não existe (o front
// então oferece o cadastro).
export async function POST(req: Request): Promise<Response> {
  try {
    const body = (await req.json()) as { nome?: string };
    const user = await loginByCharacterName(body.nome ?? '');
    if (!user) throw new HttpError(404, 'Personagem não encontrado.');
    await createSession(user);
    return Response.json({ ok: true });
  } catch (e) {
    return toResponse(e);
  }
}
