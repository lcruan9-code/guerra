'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { GuildDTO } from '@/lib/types';

const ABAS = [
  { seg: 'guerra', label: 'Guerras' },
  { seg: 'set', label: 'Montar SET' },
  { seg: 'coletar', label: 'Contas' },
  { seg: 'admin', label: 'Líder' },
] as const;

export default function GuildNav({ guild }: { guild: GuildDTO }) {
  const pathname = usePathname();
  const base = `/${guild.slug}`;

  return (
    <nav className="guild-nav">
      <Link href={base} className="guild-nav-brand">
        <span className="cinzel guild-nav-nome">{guild.nome}</span>
        <span className="guild-nav-reino">{guild.reino}</span>
      </Link>
      <div className="guild-nav-links">
        {ABAS.map((a) => {
          const href = `${base}/${a.seg}`;
          const ativo = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link key={a.seg} href={href} className={`guild-nav-link${ativo ? ' on' : ''}`}>
              {a.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
