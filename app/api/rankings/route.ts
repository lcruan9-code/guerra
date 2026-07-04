import { requireUser, toResponse } from '@/lib/auth';
import { getPlayerRankingView } from '@/lib/rankings';

export async function GET(): Promise<Response> {
  try {
    const user = await requireUser();
    return Response.json(await getPlayerRankingView(user.id));
  } catch (e) {
    return toResponse(e);
  }
}
