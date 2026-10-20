import { toResponse } from '@/lib/auth';
import { requireLeader } from '@/lib/leader-auth';
import { resolveTenantFromRequest } from "@/lib/tenant";
import { getWarSummary } from '@/lib/war';

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    const guild = await resolveTenantFromRequest(req);
    await requireLeader(guild.id);
    const { id } = await ctx.params;
    const s = await getWarSummary(id);
    // Formato flat conforme o escopo: { BM_FISICO: 5, ..., TOTAL_FISICO, TOTAL_MAGO, alerts }
    return Response.json({ ...s.counts, TOTAL_FISICO: s.TOTAL_FISICO, TOTAL_MAGO: s.TOTAL_MAGO, alerts: s.alerts });
  } catch (e) {
    return toResponse(e);
  }
}
