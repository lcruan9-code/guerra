import { requireUser, toResponse } from '@/lib/auth';
import { listCharacters, createCharacter } from '@/lib/characters';

export async function GET(): Promise<Response> {
  try {
    const user = await requireUser();
    return Response.json(await listCharacters(user.id));
  } catch (e) {
    return toResponse(e);
  }
}

export async function POST(req: Request): Promise<Response> {
  try {
    const user = await requireUser();
    const body = await req.json();
    const created = await createCharacter(user.id, body);
    return Response.json(created, { status: 201 });
  } catch (e) {
    return toResponse(e);
  }
}
