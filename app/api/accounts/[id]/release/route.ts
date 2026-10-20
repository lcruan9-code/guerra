import { releaseAccount } from '@/lib/accounts';
import { requireLeader } from '@/lib/leader-auth';
import { resolveTenantFromRequest } from '@/lib/tenant';
import { toResponse } from '@/lib/auth';

// O líder força a devolução de uma conta presa em EM_USO.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const guild = await resolveTenantFromRequest(req);
    await requireLeader(guild.id);
    await releaseAccount(guild.id, id);
    return Response.json({ ok: true });
  } catch (e) {
    return toResponse(e);
  }
}
