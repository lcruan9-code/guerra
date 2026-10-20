import { listPublicAccounts } from '@/lib/accounts';
import { resolveTenantFromRequest } from '@/lib/tenant';
import { toResponse } from '@/lib/auth';

// Lista pública (sem login) das contas ativas da guilda, para o /coletar.
export async function GET(req: Request) {
  try {
    const guild = await resolveTenantFromRequest(req);
    const servidor = new URL(req.url).searchParams.get('servidor')?.trim() || undefined;
    const accounts = await listPublicAccounts(guild.id, servidor);
    return Response.json(accounts);
  } catch (e) {
    return toResponse(e);
  }
}
