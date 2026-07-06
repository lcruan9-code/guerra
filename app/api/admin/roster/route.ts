import { toResponse } from '@/lib/auth';
import { requireLeader } from '@/lib/leader-auth';
import { getRosterView } from '@/lib/admin';

export async function GET(req: Request): Promise<Response> {
  try {
    await requireLeader();
    const eventId = new URL(req.url).searchParams.get('eventId');
    if (!eventId) return Response.json({ error: 'eventId é obrigatório.' }, { status: 400 });
    return Response.json(await getRosterView(eventId));
  } catch (e) {
    return toResponse(e);
  }
}
