import { requireUser, toResponse } from '@/lib/auth';
import { getPlayerRankingView } from '@/lib/rankings';
import { resolveTenantFromRequest } from '@/lib/tenant';

export async function GET(req: Request): Promise<Response> {
  try {
    const user = await requireUser();
    const guild = await resolveTenantFromRequest(req);
    return Response.json(await getPlayerRankingView(user.id, new Date(), guild.id));
  } catch (e) {
    return toResponse(e);
  }
}
