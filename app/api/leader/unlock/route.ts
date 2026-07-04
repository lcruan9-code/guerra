import { requireUser, toResponse } from '@/lib/auth';
import { unlockLeader } from '@/lib/leader-auth';

export async function POST(req: Request): Promise<Response> {
  try {
    await requireUser();
    const body = (await req.json()) as { senha?: string };
    await unlockLeader(body.senha ?? '');
    return Response.json({ ok: true });
  } catch (e) {
    return toResponse(e);
  }
}
