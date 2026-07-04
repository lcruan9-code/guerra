import { toResponse } from '@/lib/auth';
import { requireLeader, changeLeaderPassword } from '@/lib/leader-auth';

export async function POST(req: Request): Promise<Response> {
  try {
    await requireLeader();
    const body = (await req.json()) as { nova?: string };
    await changeLeaderPassword(body.nova ?? '');
    return Response.json({ ok: true });
  } catch (e) {
    return toResponse(e);
  }
}
