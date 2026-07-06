import { toResponse } from '@/lib/auth';
import { requireLeader } from '@/lib/leader-auth';
import { listRecentEvents } from '@/lib/admin';

export async function GET(): Promise<Response> {
  try {
    await requireLeader();
    return Response.json(await listRecentEvents());
  } catch (e) {
    return toResponse(e);
  }
}
