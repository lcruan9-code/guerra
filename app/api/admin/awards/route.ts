import { toResponse } from '@/lib/auth';
import { requireLeader } from '@/lib/leader-auth';
import { updateAward } from '@/lib/admin';
import { resolveTenantFromRequest } from '@/lib/tenant';

export async function POST(req: Request): Promise<Response> {
  try {
    const guild = await resolveTenantFromRequest(req);
    await requireLeader(guild.id);
    const body = (await req.json()) as { key?: string; ativo?: boolean; premio?: string };
    if (!body.key) return Response.json({ error: 'key é obrigatório.' }, { status: 400 });
    await updateAward(body.key, body.ativo, body.premio, guild.id);
    return Response.json({ ok: true });
  } catch (e) {
    return toResponse(e);
  }
}
