import { toResponse } from '@/lib/auth';
import { requireLeader } from '@/lib/leader-auth';
import { resolveTenantFromRequest } from "@/lib/tenant";
import { listRecentEvents } from '@/lib/admin';

export async function GET(req: Request): Promise<Response> {
  try {
    const guild = await resolveTenantFromRequest(req);
    await requireLeader(guild.id);
    return Response.json(await listRecentEvents(16, guild.id));
  } catch (e) {
    return toResponse(e);
  }
}
