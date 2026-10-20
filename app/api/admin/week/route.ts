import { toResponse } from '@/lib/auth';
import { requireLeader } from '@/lib/leader-auth';
import { resolveTenantFromRequest } from "@/lib/tenant";
import { updateWeek } from '@/lib/admin';

export async function POST(req: Request): Promise<Response> {
  try {
    const guild = await resolveTenantFromRequest(req);
    await requireLeader(guild.id);
    const body = (await req.json()) as { inicio?: string; fim?: string; texto?: string };
    await updateWeek(body.inicio, body.fim, body.texto);
    return Response.json({ ok: true });
  } catch (e) {
    return toResponse(e);
  }
}
