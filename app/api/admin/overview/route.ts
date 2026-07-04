import { requireAdmin, toResponse } from '@/lib/auth';
import { getAdminOverview } from '@/lib/admin';

export async function GET(): Promise<Response> {
  try {
    await requireAdmin();
    return Response.json(await getAdminOverview());
  } catch (e) {
    return toResponse(e);
  }
}
