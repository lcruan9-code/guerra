import { listAccounts, createAccount } from '@/lib/accounts';
import { requireLeader } from '@/lib/leader-auth';
import { resolveTenantFromRequest } from '@/lib/tenant';
import { toResponse } from '@/lib/auth';

export async function GET(req: Request) {
  try {
    const guild = await resolveTenantFromRequest(req);
    await requireLeader(guild.id);
    const accounts = await listAccounts(guild.id, true);
    return Response.json(accounts);
  } catch (e) {
    return toResponse(e);
  }
}

export async function POST(req: Request) {
  try {
    const guild = await resolveTenantFromRequest(req);
    await requireLeader(guild.id);
    const body = await req.json();
    await createAccount(guild.id, body);
    return Response.json({ ok: true });
  } catch (e) {
    return toResponse(e);
  }
}
