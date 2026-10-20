import { collectAccountPublic } from '@/lib/accounts';
import { ensureHolderId } from '@/lib/holder';
import { resolveTenantFromRequest } from '@/lib/tenant';
import { HttpError, toResponse } from '@/lib/auth';

// Portador público pega uma conta emprestada (1 por navegador, com lock de linha).
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const guild = await resolveTenantFromRequest(req);
    const body = await req.json().catch(() => null);
    const nome = body?.nome_pessoa;
    const origem = body?.servidor_origem;
    if (typeof nome !== 'string' || typeof origem !== 'string') {
      throw new HttpError(400, 'Informe o seu nome e o servidor de origem.');
    }
    const holderId = await ensureHolderId();
    const creds = await collectAccountPublic(guild.id, id, holderId, nome, origem);
    return Response.json(creds);
  } catch (e) {
    return toResponse(e);
  }
}
