import { toResponse } from '@/lib/auth';
import { requireLeader } from '@/lib/leader-auth';
import { setEventKs } from '@/lib/admin';

export async function POST(req: Request): Promise<Response> {
  try {
    await requireLeader();
    const body = (await req.json()) as { eventId?: string; userId?: string | null };
    if (!body.eventId) return Response.json({ error: 'eventId é obrigatório.' }, { status: 400 });
    await setEventKs(body.eventId, body.userId ?? null);
    return Response.json({ ok: true });
  } catch (e) {
    return toResponse(e);
  }
}
