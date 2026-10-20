import Link from 'next/link';
import { getGuildBySlug } from '@/lib/tenant';
import { notFound } from 'next/navigation';

const ATALHOS = [
  { href: 'guerra', titulo: 'Guerras', desc: 'Confirme presença na Torre, Kefra e Noatum.', icone: '⚔️' },
  { href: 'set', titulo: 'Montar SET', desc: 'Monte seu equipamento e veja seu Gear Score.', icone: '🛡️' },
  { href: 'coletar', titulo: 'Coleta de Contas', desc: 'Pegue uma conta emprestada para a guerra.', icone: '🔑' },
  { href: 'admin', titulo: 'Painel do Líder', desc: 'Roster, horários, KS, prêmios e força.', icone: '👑' },
];

export default async function GuildHub({ params }: { params: Promise<{ guild: string }> }) {
  const { guild: slug } = await params;
  const guild = await getGuildBySlug(slug);
  if (!guild) notFound();

  return (
    <div className="guild-hub">
      <header className="guild-hub-head">
        {guild.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={guild.logo_url} alt={`Brasão de ${guild.nome}`} className="guild-brasao" />
        ) : (
          <div className="guild-brasao guild-brasao-fallback cinzel">{guild.nome.slice(0, 2).toUpperCase()}</div>
        )}
        <h1 className="cinzel guild-hub-nome">{guild.nome}</h1>
        <p className="guild-hub-sub">
          Reino <strong>{guild.reino}</strong> · Servidor <strong>{guild.servidor}</strong>
        </p>
      </header>

      <div className="guild-cards">
        {ATALHOS.map((a) => (
          <Link key={a.href} href={`/${guild.slug}/${a.href}`} className="guild-card">
            <span className="guild-card-ico" aria-hidden="true">{a.icone}</span>
            <span className="guild-card-titulo cinzel">{a.titulo}</span>
            <span className="guild-card-desc">{a.desc}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
