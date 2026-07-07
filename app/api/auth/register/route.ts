import { createSession, toResponse } from '@/lib/auth';
import { registerWithFirstCharacter } from '@/lib/characters';

// Cadastro sem login: cria o usuário + 1º personagem e abre a sessão (cookie).
export async function POST(req: Request): Promise<Response> {
  try {
    const body = await req.json();
    const user = await registerWithFirstCharacter(body);
    await createSession(user);
    return Response.json({ ok: true }, { status: 201 });
  } catch (e) {
    return toResponse(e);
  }
}
