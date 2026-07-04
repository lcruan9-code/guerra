import { requireAdmin, toResponse } from '@/lib/auth';
import { updateWeek } from '@/lib/admin';

export async function POST(req: Request): Promise<Response> {
  try {
    await requireAdmin();
    const body = (await req.json()) as { inicio?: string; fim?: string; texto?: string };
    await updateWeek(body.inicio, body.fim, body.texto);
    return Response.json({ ok: true });
  } catch (e) {
    return toResponse(e);
  }
}
