import { toResponse } from '@/lib/auth';
import { requireLeader } from '@/lib/leader-auth';
import { resolveTenantFromRequest } from "@/lib/tenant";
import { setKs } from '@/lib/admin';

export async function POST(req: Request): Promise<Response> {
  try {
    const guild = await resolveTenantFromRequest(req);
    await requireLeader(guild.id);
    const body = (await req.json()) as { eventId?: string; userId?: string; ks?: number };
    if (!body.eventId || !body.userId || typeof body.ks !== 'number') {
      return Response.json({ error: 'eventId, userId e ks são obrigatórios.' }, { status: 400 });
    }
    await setKs(body.eventId, body.userId, body.ks);
    return Response.json({ ok: true });
  } catch (e) {
    return toResponse(e);
  }
}
