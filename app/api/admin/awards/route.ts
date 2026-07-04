import { requireAdmin, toResponse } from '@/lib/auth';
import { updateAward } from '@/lib/admin';

export async function POST(req: Request): Promise<Response> {
  try {
    await requireAdmin();
    const body = (await req.json()) as { key?: string; ativo?: boolean; premio?: string };
    if (!body.key) return Response.json({ error: 'key é obrigatório.' }, { status: 400 });
    await updateAward(body.key, body.ativo, body.premio);
    return Response.json({ ok: true });
  } catch (e) {
    return toResponse(e);
  }
}
