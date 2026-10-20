import { setAccountActive } from '@/lib/accounts';
import { requireLeader } from '@/lib/leader-auth';
import { resolveTenantFromRequest } from '@/lib/tenant';
import { HttpError, toResponse } from '@/lib/auth';

// Ativa/inativa uma conta — inativa não aparece no /coletar.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const guild = await resolveTenantFromRequest(req);
    await requireLeader(guild.id);
    const body = await req.json().catch(() => null);
    if (typeof body?.ativo !== 'boolean') throw new HttpError(400, 'Campo "ativo" deve ser true ou false.');
    await setAccountActive(guild.id, id, body.ativo);
    return Response.json({ ok: true });
  } catch (e) {
    return toResponse(e);
  }
}
