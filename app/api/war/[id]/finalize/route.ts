import { toResponse, HttpError } from '@/lib/auth';
import { requireLeader } from '@/lib/leader-auth';
import { resolveTenantFromRequest } from "@/lib/tenant";
import { getEvent, finalizeEvent } from '@/lib/events';

// "Kefra morto": o líder encerra a guerra manualmente (antes do fim automático).
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    const guild = await resolveTenantFromRequest(req);
    await requireLeader(guild.id);
    const { id } = await ctx.params;
    const event = await getEvent(id);
    if (!event) throw new HttpError(404, 'Guerra não encontrada.');
    await finalizeEvent(id);
    return Response.json({ ok: true });
  } catch (e) {
    return toResponse(e);
  }
}
