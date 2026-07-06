import { requireUser, toResponse } from '@/lib/auth';
import { hasLeaderAccess } from '@/lib/leader-auth';
import { ensureDayEvents } from '@/lib/events';
import { getMyConfirmation, getUserPoints } from '@/lib/war';
import { listCharacters } from '@/lib/characters';

export async function GET(): Promise<Response> {
  try {
    const user = await requireUser();
    const events = await ensureDayEvents();
    const now = Date.now();
    const [characters, pontos, leaderUnlocked] = await Promise.all([
      listCharacters(user.id),
      getUserPoints(user.id),
      hasLeaderAccess(),
    ]);
    const wars = await Promise.all(
      events.map(async (event) => {
        const mine = await getMyConfirmation(user.id, event.id);
        return {
          id: event.id,
          tipo: event.tipo,
          dataIso: new Date(event.data).toISOString(),
          locked: now >= new Date(event.data).getTime(),
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
