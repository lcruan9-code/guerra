import { toResponse } from '@/lib/auth';
import { requireLeader } from '@/lib/leader-auth';
import { resolveTenantFromRequest } from "@/lib/tenant";
import { updateWarTimes } from '@/lib/admin';

export async function POST(req: Request): Promise<Response> {
  try {
    const guild = await resolveTenantFromRequest(req);
    await requireLeader(guild.id);
    const body = (await req.json()) as {
      torre?: string;
      kefra?: string;
      torreTerca?: string;
      durTorre?: number;
      durKefra?: number;
    };
    await updateWarTimes(body);
    return Response.json({ ok: true });
  } catch (e) {
    return toResponse(e);
  }
}
