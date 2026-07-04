import { requireUser, toResponse } from '@/lib/auth';
import { updateCharacter } from '@/lib/characters';

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    const body = await req.json();
    return Response.json(await updateCharacter(user.id, id, body));
  } catch (e) {
    return toResponse(e);
  }
}
