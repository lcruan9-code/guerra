import { verifyLicense } from '@/lib/licenses';
import { toResponse } from '@/lib/auth';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const key = url.searchParams.get('key');
    if (!key) {
      return Response.json({ error: 'Informe a chave de licença.' }, { status: 400 });
    }

    const license = await verifyLicense(key);
    return Response.json(license);
  } catch (e) {
    return toResponse(e);
  }
}
