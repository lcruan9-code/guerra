import { toResponse } from '@/lib/auth';
import { requireLeader } from '@/lib/leader-auth';
import { getAdminOverview } from '@/lib/admin';

export async function GET(): Promise<Response> {
  try {
    await requireLeader();
    return Response.json(await getAdminOverview());
  } catch (e) {
    return toResponse(e);
  }
}
