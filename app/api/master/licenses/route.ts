import { generateLicenseKey, listLicenses } from '@/lib/licenses';
import { listAllGuilds } from '@/lib/tenant';
import { toResponse, HttpError } from '@/lib/auth';
import type { LicensePlan } from '@/lib/types';

function checkMasterAuth(req: Request) {
  const masterKey = process.env.MASTER_KEY || 'wyd-saas-master-2026';
  const authHeader = req.headers.get('authorization')?.replace('Bearer ', '');
  if (authHeader !== masterKey) {
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
