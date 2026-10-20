import { updateAccount, deleteAccount } from '@/lib/accounts';
import { requireLeader } from '@/lib/leader-auth';
import { resolveTenantFromRequest } from '@/lib/tenant';
import { toResponse } from '@/lib/auth';

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const guild = await resolveTenantFromRequest(req);
    await requireLeader(guild.id);
    const body = await req.json();
    await updateAccount(guild.id, id, body);
    return Response.json({ ok: true });
  } catch (e) {
    return toResponse(e);
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const guild = await resolveTenantFromRequest(req);
    await requireLeader(guild.id);
    await deleteAccount(guild.id, id);
    return Response.json({ ok: true });
  } catch (e) {
    return toResponse(e);
  }
}
