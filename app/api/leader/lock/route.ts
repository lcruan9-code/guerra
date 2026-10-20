import { toResponse } from '@/lib/auth';
import { lockLeader } from '@/lib/leader-auth';
import { resolveTenantFromRequest } from '@/lib/tenant';

export async function POST(req: Request): Promise<Response> {
  try {
    const guild = await resolveTenantFromRequest(req);
    await lockLeader(guild.id);
    return Response.json({ ok: true });
  } catch (e) {
    return toResponse(e);
  }
}
