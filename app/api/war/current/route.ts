import { requireUser, toResponse } from '@/lib/auth';
import { hasLeaderAccess } from '@/lib/leader-auth';
import { ensureDayEvents, isEventEnded } from '@/lib/events';
import { getMyConfirmation, getUserPoints } from '@/lib/war';
import { listCharacters } from '@/lib/characters';
import { resolveTenantFromRequest } from '@/lib/tenant';

export async function GET(req: Request): Promise<Response> {
  try {
    const user = await requireUser();
    const guild = await resolveTenantFromRequest(req);
    const events = await ensureDayEvents(new Date(), guild.id);
    const now = Date.now();
    const [characters, pontos, leaderUnlocked] = await Promise.all([
      listCharacters(user.id),
      getUserPoints(user.id),
      hasLeaderAccess(guild.id),
    ]);
    const nowDate = new Date(now);
    const wars = await Promise.all(
      events.map(async (event) => {
        const mine = await getMyConfirmation(user.id, event.id);
        return {
          id: event.id,
          tipo: event.tipo,
          dataIso: new Date(event.data).toISOString(),
          endsIso: event.fim ? new Date(event.fim).toISOString() : null,
          locked: now >= new Date(event.data).getTime(),
          ended: isEventEnded(event, nowDate),
          myConfirmation: mine ? { status: mine.status, characterId: mine.character_id } : null,
        };
      }),
    );
    return Response.json({
      user: { nome: user.nome, role: user.role, pontos },
      characters,
      leaderUnlocked,
      wars,
    });
  } catch (e) {
    return toResponse(e);
  }
}
