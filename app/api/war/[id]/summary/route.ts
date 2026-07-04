import { requireAdmin, toResponse } from '@/lib/auth';
import { getWarSummary } from '@/lib/war';

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    await requireAdmin();
    const { id } = await ctx.params;
    const s = await getWarSummary(id);
    // Formato flat conforme o escopo: { BM_FISICO: 5, ..., TOTAL_FISICO, TOTAL_MAGO, alerts }
    return Response.json({ ...s.counts, TOTAL_FISICO: s.TOTAL_FISICO, TOTAL_MAGO: s.TOTAL_MAGO, alerts: s.alerts });
  } catch (e) {
    return toResponse(e);
  }
}
