import { requireUser, toResponse } from '@/lib/auth';
import { updateEquipment } from '@/lib/characters';

// Salva o set do personagem (só o dono edita).
export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    const body = await req.json();
    return Response.json(await updateEquipment(user.id, id, body));
  } catch (e) {
    return toResponse(e);
  }
}
