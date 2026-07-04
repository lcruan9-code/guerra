import { requireAdmin, toResponse } from '@/lib/auth';
import { updateWarTimes } from '@/lib/admin';

export async function POST(req: Request): Promise<Response> {
  try {
    await requireAdmin();
    const body = (await req.json()) as { torre?: string; noatum?: string };
    await updateWarTimes(body.torre, body.noatum);
    return Response.json({ ok: true });
  } catch (e) {
    return toResponse(e);
  }
}
