import { toResponse } from '@/lib/auth';
import { requireLeader } from '@/lib/leader-auth';
import { resolveTenantFromRequest } from "@/lib/tenant";
import { gearRanking } from '@/lib/admin';

export async function GET(req: Request): Promise<Response> {
  try {
    const guild = await resolveTenantFromRequest(req);
    await requireLeader(guild.id);
    return Response.json(await gearRanking(guild.id));
  } catch (e) {
    return toResponse(e);
  }
}
