import { timingSafeEqual } from 'crypto';
import { generateLicenseKey, listLicenses } from '@/lib/licenses';
import { listAllGuilds } from '@/lib/tenant';
import { toResponse, HttpError } from '@/lib/auth';
import type { LicensePlan } from '@/lib/types';

function checkMasterAuth(req: Request) {
  // Sem fallback literal: a chave estaria em arquivo público num site já no ar.
  const masterKey = process.env.MASTER_KEY;
  if (!masterKey) {
    throw new HttpError(503, 'MASTER_KEY não configurada no servidor. Painel Master indisponível.');
  }
  const sent = req.headers.get('authorization')?.replace('Bearer ', '') ?? '';
  const a = Buffer.from(sent);
  const b = Buffer.from(masterKey);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new HttpError(401, 'Acesso restrito ao Administrador Geral (Master Key inválida).');
  }
}

export async function GET(req: Request) {
  try {
    checkMasterAuth(req);
    const [licenses, guilds] = await Promise.all([listLicenses(), listAllGuilds()]);
    return Response.json({ licenses, guilds });
  } catch (e) {
    return toResponse(e);
  }
}

export async function POST(req: Request) {
  try {
    checkMasterAuth(req);
    const body = await req.json();
    const plano = (body.plano || 'MENSAL') as LicensePlan;
    const license = await generateLicenseKey(plano);
    return Response.json(license);
  } catch (e) {
    return toResponse(e);
  }
}
