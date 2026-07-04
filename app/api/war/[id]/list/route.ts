import { requireUser, toResponse } from '@/lib/auth';
import { getWarLists } from '@/lib/war';

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    await requireUser();
    const { id } = await ctx.params;
    return Response.json(await getWarLists(id));
  } catch (e) {
    return toResponse(e);
  }
}
