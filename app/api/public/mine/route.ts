import { getHeldAccount } from '@/lib/accounts';
import { getHolderId } from '@/lib/holder';
import { resolveTenantFromRequest } from '@/lib/tenant';
import { toResponse } from '@/lib/auth';

// Conta que ESTE navegador está segurando agora nesta guilda (null se nenhuma).
export async function GET(req: Request) {
  try {
    const guild = await resolveTenantFromRequest(req);
    const holderId = await getHolderId();
    if (!holderId) return Response.json(null);
    const held = await getHeldAccount(guild.id, holderId);
    return Response.json(held);
  } catch (e) {
    return toResponse(e);
  }
}
