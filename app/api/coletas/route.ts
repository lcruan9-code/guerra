import { listColetas } from '@/lib/accounts';
import { requireLeader } from '@/lib/leader-auth';
import { resolveTenantFromRequest } from '@/lib/tenant';
import { toResponse } from '@/lib/auth';

// Histórico de empréstimos/devoluções para a aba de auditoria do líder.
export async function GET(req: Request) {
  try {
    const guild = await resolveTenantFromRequest(req);
    await requireLeader(guild.id);
    const coletas = await listColetas(guild.id);
    return Response.json(coletas);
  } catch (e) {
    return toResponse(e);
  }
}
