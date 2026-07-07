import { toResponse } from '@/lib/auth';
import { requireLeader } from '@/lib/leader-auth';
import { updateWarTimes } from '@/lib/admin';

export async function POST(req: Request): Promise<Response> {
  try {
    await requireLeader();
    const body = (await req.json()) as {
      torre?: string;
      kefra?: string;
      durTorre?: number;
      durKefra?: number;
    };
    await updateWarTimes(body);
    return Response.json({ ok: true });
  } catch (e) {
    return toResponse(e);
  }
}
