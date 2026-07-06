import { toResponse } from '@/lib/auth';
import { requireLeader } from '@/lib/leader-auth';
import { getDayView } from '@/lib/admin';

export async function GET(req: Request): Promise<Response> {
  try {
    await requireLeader();
    const dia = new URL(req.url).searchParams.get('dia');
    if (!dia) return Response.json({ error: 'dia é obrigatório.' }, { status: 400 });
    return Response.json(await getDayView(dia));
  } catch (e) {
    return toResponse(e);
  }
}
