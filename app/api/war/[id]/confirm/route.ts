import { requireUser, toResponse } from '@/lib/auth';
import { confirmPresence } from '@/lib/war';

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    const body = (await req.json()) as { status?: string; characterId?: string | null };
    await confirmPresence(user.id, id, body.status ?? '', body.characterId ?? null);
    return Response.json({ ok: true });
  } catch (e) {
    return toResponse(e);
  }
}
