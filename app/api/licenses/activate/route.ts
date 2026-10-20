import { activateLicense } from '@/lib/licenses';
import { toResponse } from '@/lib/auth';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { key, slug, nome, reino, servidor, logo_url } = body;
    if (!key || !slug || !nome || !reino || !servidor) {
      return Response.json(
        { error: 'Preencha a chave, o link (slug), nome, reino e servidor.' },
        { status: 400 },
      );
    }

    const result = await activateLicense(key, {
      slug,
      nome,
      reino,
      servidor,
      logo_url,
    });

    return Response.json(result);
  } catch (e) {
    return toResponse(e);
  }
}
