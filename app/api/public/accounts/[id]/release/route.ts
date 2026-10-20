import { releaseAccountPublic } from '@/lib/accounts';
import { getHolderId } from '@/lib/holder';
import { resolveTenantFromRequest } from '@/lib/tenant';
import { HttpError, toResponse } from '@/lib/auth';

// Portador devolve a conta que está em sua posse.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const guild = await resolveTenantFromRequest(req);
    const holderId = await getHolderId();
    if (!holderId) throw new HttpError(403, 'Você só pode devolver a conta que pegou.');
    await releaseAccountPublic(guild.id, id, holderId);
    return Response.json({ ok: true });
  } catch (e) {
    return toResponse(e);
  }
}
