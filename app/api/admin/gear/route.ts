import { toResponse } from '@/lib/auth';
import { requireLeader } from '@/lib/leader-auth';
import { gearRanking } from '@/lib/admin';

export async function GET(): Promise<Response> {
  try {
    await requireLeader();
    return Response.json(await gearRanking());
  } catch (e) {
    return toResponse(e);
  }
}
