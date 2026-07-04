import { toResponse } from '@/lib/auth';
import { requireLeader } from '@/lib/leader-auth';
import { controlEvent } from '@/lib/admin';

export async function POST(req: Request): Promise<Response> {
  try {
    await requireLeader();
    const body = (await req.json()) as { eventId?: string; action?: string; dataIso?: string };
    if (!body.eventId || !body.action) {
      return Response.json({ error: 'eventId e action são obrigatórios.' }, { status: 400 });
    }
    await controlEvent(body.eventId, body.action, body.dataIso);
    return Response.json({ ok: true });
  } catch (e) {
    return toResponse(e);
  }
}
