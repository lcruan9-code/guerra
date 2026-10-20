import { requireUser, toResponse } from '@/lib/auth';
import { unlockLeader } from '@/lib/leader-auth';
import { resolveTenantFromRequest } from '@/lib/tenant';

export async function POST(req: Request): Promise<Response> {
  try {
    await requireUser();
    const guild = await resolveTenantFromRequest(req);
    const body = (await req.json()) as { senha?: string };
    await unlockLeader(body.senha ?? '', guild.id);
    return Response.json({ ok: true });
  } catch (e) {
    return toResponse(e);
  }
}
