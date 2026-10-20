import { getGuildBySlug } from '@/lib/tenant';

// Manifesto por guilda: o membro instala o PWA com o nome da SUA guilda e cai
// direto no hub dela, não na landing comercial.
export async function GET(_req: Request, { params }: { params: Promise<{ guild: string }> }) {
  const { guild: slug } = await params;
  const guild = await getGuildBySlug(slug);

  if (!guild) {
    return Response.json({ error: 'Guilda não encontrada.' }, { status: 404 });
  }

  const corFundo = guild.reino === 'BLUE' ? '#05080f' : '#0a0705';

  return Response.json(
    {
      name: `${guild.nome} — Guerra`,
      short_name: guild.nome,
      description: `Presença de guerra, SET e banco de contas da guilda ${guild.nome}`,
      start_url: `/${guild.slug}`,
      scope: `/${guild.slug}`,
      display: 'standalone',
      background_color: corFundo,
      theme_color: corFundo,
      orientation: 'portrait',
      icons: [
        { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
    { headers: { 'Content-Type': 'application/manifest+json' } },
  );
}
