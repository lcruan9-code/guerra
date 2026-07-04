import { requireAdmin, toResponse } from '@/lib/auth';
import { setPlayerStats } from '@/lib/admin';

export async function POST(req: Request): Promise<Response> {
  try {
    await requireAdmin();
    const body = (await req.json()) as {
      eventId?: string;
      userId?: string;
      participou?: boolean;
      ks?: number;
      kefra?: number;
    };
    if (!body.eventId || !body.userId) {
      return Response.json({ error: 'eventId e userId são obrigatórios.' }, { status: 400 });
    }
    await setPlayerStats(body.eventId, body.userId, {
      participou: body.participou,
      ks: body.ks,
      kefra: body.kefra,
    });
    return Response.json({ ok: true });
  } catch (e) {
    return toResponse(e);
  }
}
