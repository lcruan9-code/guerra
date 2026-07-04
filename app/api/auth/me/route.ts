import { requireUser, toResponse } from '@/lib/auth';

export async function GET(): Promise<Response> {
  try {
    const user = await requireUser();
    return Response.json({ nome: user.nome, role: user.role });
  } catch (e) {
    return toResponse(e);
  }
}
