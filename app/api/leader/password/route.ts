import { toResponse } from '@/lib/auth';
import { requireLeader, changeLeaderPassword } from '@/lib/leader-auth';
import { resolveTenantFromRequest } from '@/lib/tenant';

export async function POST(req: Request): Promise<Response> {
  try {
    const guild = await resolveTenantFromRequest(req);
    await requireLeader(guild.id);
    const body = (await req.json()) as { nova?: string };
    await changeLeaderPassword(body.nova ?? '', guild.id);
    return Response.json({ ok: true });
  } catch (e) {
    return toResponse(e);
  }
}
