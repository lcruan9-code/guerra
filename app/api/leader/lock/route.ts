import { toResponse } from '@/lib/auth';
import { lockLeader } from '@/lib/leader-auth';

export async function POST(): Promise<Response> {
  try {
    await lockLeader();
    return Response.json({ ok: true });
  } catch (e) {
    return toResponse(e);
  }
}
