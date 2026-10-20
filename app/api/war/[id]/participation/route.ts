import { toResponse } from '@/lib/auth';
import { requireLeader } from '@/lib/leader-auth';
import { resolveTenantFromRequest } from "@/lib/tenant";
import { setParticipation } from '@/lib/war';

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    const guild = await resolveTenantFromRequest(req);
    await requireLeader(guild.id);
    const { id } = await ctx.params;
    const body = (await req.json()) as { userId?: string; participou?: boolean };
    if (!body.userId || typeof body.participou !== 'boolean') {
      return Response.json({ error: 'userId e participou são obrigatórios.' }, { status: 400 });
    }
    await setParticipation(id, body.userId, body.participou);
    return Response.json({ ok: true });
  } catch (e) {
    return toResponse(e);
  }
}
