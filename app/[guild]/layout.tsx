import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getGuildBySlug } from '@/lib/tenant';
import GuildNav from '@/components/GuildNav';

type Params = { guild: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { guild: slug } = await params;
  const guild = await getGuildBySlug(slug);
  if (!guild) return { title: 'Guilda não encontrada' };

  return {
    title: `${guild.nome} — Guilds WYD`,
    description: `Painel da guilda ${guild.nome} (${guild.reino} · ${guild.servidor})`,
    // Cada guilda tem o seu manifesto: instalado, o app leva o nome dela e abre no hub dela.
    manifest: `/${guild.slug}/manifest.webmanifest`,
    appleWebApp: { capable: true, title: guild.nome, statusBarStyle: 'black-translucent' },
  };
}

export default async function GuildLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<Params>;
}) {
  const { guild: slug } = await params;
  const guild = await getGuildBySlug(slug);

  // 404 em vez de erro: o slug vem da URL, digitado por qualquer um.
  if (!guild) notFound();

  if (!guild.ativa) {
    return (
      <div className="center-screen">
        <div className="guild-blocked">
          <h1 className="cinzel">{guild.nome}</h1>
          <p>Esta guilda está desativada. Fale com o líder para renovar a licença.</p>
        </div>
      </div>
    );
  }

  // O tema sai do reino; cor_tema (se houver) sobrepõe o accent da guilda.
  const style = guild.cor_tema ? ({ ['--accent' as string]: guild.cor_tema }) : undefined;

  return (
    <div className="guild-shell" data-reino={guild.reino} style={style}>
      <GuildNav guild={guild} />
      <main className="guild-main">{children}</main>
    </div>
  );
}
