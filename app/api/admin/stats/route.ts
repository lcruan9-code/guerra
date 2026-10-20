import { toResponse } from '@/lib/auth';
import { requireLeader } from '@/lib/leader-auth';
import { resolveTenantFromRequest } from "@/lib/tenant";
import { setParticipation } from '@/lib/admin';

export async function POST(req: Request): Promise<Response> {
  try {
    const guild = await resolveTenantFromRequest(req);
    await requireLeader(guild.id);
    const body = (await req.json()) as { eventId?: string; userId?: string; participou?: boolean };
    if (!body.eventId || !body.userId || typeof body.participou !== 'boolean') {
      return Response.json({ error: 'eventId, userId e participou são obrigatórios.' }, { status: 400 });
    }
    await setParticipation(body.eventId, body.userId, body.participou);
    return Response.json({ ok: true });
  } catch (e) {
    return toResponse(e);
  }
}
