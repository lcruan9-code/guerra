import { NextResponse, type NextRequest } from 'next/server';

// Primeiro segmento da URL que NÃO é slug de guilda.
const RESERVADOS = new Set(['api', 'master', '_next', 'favicon.ico', 'manifest.webmanifest', 'icons']);

// As páginas da guilda vivem em /[slug]/..., mas os fetches do cliente vão para
// /api/... (sem o slug na URL). Para o servidor saber de qual guilda se trata,
// gravamos o slug no cookie `wyd_guild` — que é justamente uma das fontes lidas
// por resolveTenantFromRequest().
export function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const slug = req.nextUrl.pathname.split('/')[1]?.toLowerCase();

  if (slug && !RESERVADOS.has(slug) && !slug.includes('.')) {
    if (req.cookies.get('wyd_guild')?.value !== slug) {
      res.cookies.set('wyd_guild', slug, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 30,
      });
    }
  }
  return res;
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\.png$|.*\.webmanifest$).*)'],
};
