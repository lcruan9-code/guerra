import { requireUser, toResponse } from '@/lib/auth';
import { ensureNextEvent } from '@/lib/events';
import { getMyConfirmation, getUserPoints } from '@/lib/war';
import { listCharacters } from '@/lib/characters';

export async function GET(): Promise<Response> {
  try {
    const user = await requireUser();
    const event = await ensureNextEvent();
    const [mine, characters, pontos] = await Promise.all([
      getMyConfirmation(user.id, event.id),
      listCharacters(user.id),
      getUserPoints(user.id),
    ]);
    return Response.json({
      user: { nome: user.nome, role: user.role, pontos },
      event: {
        id: event.id,
        tipo: event.tipo,
        dataIso: new Date(event.data).toISOString(),
        locked: new Date() >= new Date(event.data),
      },
      myConfirmation: mine ? { status: mine.status, characterId: mine.character_id } : null,
      characters,
    });
  } catch (e) {
    return toResponse(e);
  }
}
