import { toResponse } from '@/lib/auth';
import { requireLeader } from '@/lib/leader-auth';
import { getAdminOverview } from '@/lib/admin';
import { resolveTenantFromRequest } from '@/lib/tenant';

export async function GET(req: Request): Promise<Response> {
  try {
    const guild = await resolveTenantFromRequest(req);
    await requireLeader(guild.id);
    return Response.json(await getAdminOverview(guild.id));
  } catch (e) {
    return toResponse(e);
  }
}
