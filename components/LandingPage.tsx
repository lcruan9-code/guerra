'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api-client';
import type { GuildDTO, LicenseDTO, LicensePlan, Reino, Servidor } from '@/lib/types';

const PILARES = [
  {
    icone: '⚔️',
    titulo: 'Presença Tática',
    desc: 'Roster de classes em tempo real para Torre (seg–sex), Kefra (terça) e Noatum (domingo). O membro entra só com o nome do personagem — sem senha, sem fricção.',
  },
  {
    icone: '🛡️',
    titulo: 'SET e Gear Score',
    desc: 'Grade de equipamento fiel à janela do jogo, com refino por slot e Gear Score de 0 a 48 calculado automático. Ranking de força da guilda pronto para o líder.',
  },
  {
    icone: '🔑',
    titulo: 'Banco de Contas',
    desc: 'Empréstimo de contas para guerra com senha cifrada em repouso (AES-256-GCM), uma conta por pessoa e trava de concorrência no banco.',
  },
];

const PLANOS: { plano: LicensePlan; titulo: string; nota: string; destaque?: boolean }[] = [
  { plano: 'MENSAL', titulo: 'Mensal', nota: '30 dias de acesso' },
  { plano: 'TRIMESTRAL', titulo: 'Trimestral', nota: '90 dias de acesso' },
  { plano: 'SEMESTRAL', titulo: 'Semestral', nota: '180 dias de acesso', destaque: true },
  { plano: 'VITALICIO', titulo: 'Vitalício', nota: 'sem vencimento' },
];

const REINOS: Reino[] = ['RED', 'BLUE'];
const SERVIDORES: Servidor[] = ['INFINITY', 'ROGUE'];

function slugify(v: string): string {
  return v
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);
}

export default function LandingPage() {
  const router = useRouter();
  const [aberto, setAberto] = useState<null | 'ativar' | 'acessar'>(null);

  // formulário de ativação
  const [key, setKey] = useState('');
  const [nome, setNome] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTocado, setSlugTocado] = useState(false);
  const [reino, setReino] = useState<Reino>('RED');
  const [servidor, setServidor] = useState<Servidor>('ROGUE');
  const [checando, setChecando] = useState(false);
  const [licenca, setLicenca] = useState<LicenseDTO | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  // acessar guilda existente
  const [slugBusca, setSlugBusca] = useState('');

  function trocarNome(v: string) {
    setNome(v);
    if (!slugTocado) setSlug(slugify(v));
  }

  async function checarChave() {
    if (!key.trim()) return;
    setChecando(true);
    setErro(null);
    setLicenca(null);
    try {
      const lic = await api<LicenseDTO>(`/api/licenses/validate?key=${encodeURIComponent(key.trim())}`);
      if (lic.status !== 'DISPONIVEL') {
        setErro(
          lic.status === 'ATIVA'
            ? 'Essa chave já foi usada para ativar uma guilda.'
            : `Chave ${lic.status.toLowerCase()}.`,
        );
      } else {
        setLicenca(lic);
      }
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : 'Não foi possível validar a chave.');
    } finally {
      setChecando(false);
    }
  }

  async function ativar() {
    setErro(null);
    if (!key.trim() || !nome.trim() || !slug.trim()) {
      setErro('Preencha a chave, o nome da guilda e o link.');
      return;
    }
    setEnviando(true);
    try {
      const res = await api<{ guild: GuildDTO }>('/api/licenses/activate', {
        method: 'POST',
        body: JSON.stringify({ key: key.trim(), slug: slug.trim(), nome: nome.trim(), reino, servidor }),
      });
      router.push(`/${res.guild.slug}`);
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : 'Não foi possível ativar a guilda.');
      setEnviando(false);
    }
  }

  function acessar() {
    const s = slugify(slugBusca);
    if (s) router.push(`/${s}`);
  }

  return (
    <div className="lp">
      <header className="lp-hero">
        <p className="lp-kicker cinzel">Guilds WYD</p>
        <h1 className="lp-titulo cinzel">A ferramenta definitiva para sua Guilda no WYD</h1>
        <p className="lp-sub">
          Presença de guerra, montagem de SET e banco de contas — tudo num endereço só, com a cara da sua guilda.
        </p>
        <div className="lp-cta">
          <button type="button" className="lp-btn-primario cinzel" onClick={() => setAberto('ativar')}>
            Já tenho uma chave → Ativar minha guilda
          </button>
          <button type="button" className="btn-ghost" onClick={() => setAberto('acessar')}>
            Acessar guilda existente
          </button>
        </div>
      </header>

      <section className="lp-pilares">
        {PILARES.map((p) => (
          <article key={p.titulo} className="lp-pilar">
            <span className="lp-pilar-ico" aria-hidden="true">{p.icone}</span>
            <h2 className="cinzel">{p.titulo}</h2>
            <p>{p.desc}</p>
          </article>
        ))}
      </section>

      <section className="lp-planos">
        <h2 className="cinzel lp-secao-titulo">Planos</h2>
        <p className="lp-secao-sub">
          A licença é vendida ao líder. Com a chave em mãos, a guilda é ativada em menos de um minuto.
        </p>
        <div className="lp-planos-grid">
          {PLANOS.map((p) => (
            <div key={p.plano} className={`lp-plano${p.destaque ? ' destaque' : ''}`}>
              {p.destaque && <span className="lp-plano-selo">mais escolhido</span>}
              <h3 className="cinzel">{p.titulo}</h3>
              <p className="lp-plano-nota">{p.nota}</p>
              <ul className="lp-plano-itens">
                <li>URL própria /sua-guilda</li>
                <li>Tema do seu reino</li>
                <li>Membros ilimitados</li>
                <li>Banco de contas incluso</li>
              </ul>
            </div>
          ))}
        </div>
        <p className="lp-contato">Para comprar uma chave, fale com a administração da plataforma.</p>
      </section>

      {aberto === 'ativar' && (
        <div className="lp-overlay" role="dialog" aria-modal="true" aria-label="Ativar minha guilda">
          <div className="lp-modal">
            <h2 className="cinzel">Ativar minha guilda</h2>

            <label className="field-blk">
              <span className="field-label">Chave de licença</span>
              <input
                className="field-input"
                value={key}
                onChange={(e) => {
                  setKey(e.target.value.toUpperCase());
                  setLicenca(null);
                }}
                onBlur={checarChave}
                placeholder="WYD-XXXX-YYYY-ZZZZ"
                autoComplete="off"
              />
            </label>
            {checando && <p className="muted">Conferindo a chave…</p>}
            {licenca && <p className="lp-ok">Chave válida · plano {licenca.plano}</p>}

            <label className="field-blk">
              <span className="field-label">Nome da guilda</span>
              <input
                className="field-input"
                value={nome}
                onChange={(e) => trocarNome(e.target.value)}
                placeholder="IMPERIUM"
                maxLength={40}
              />
            </label>

            <label className="field-blk">
              <span className="field-label">Link da guilda</span>
              <div className="lp-slug">
                <span className="lp-slug-pre">/</span>
                <input
                  className="field-input"
                  value={slug}
                  onChange={(e) => {
                    setSlugTocado(true);
                    setSlug(slugify(e.target.value));
                  }}
                  placeholder="imperium"
                />
              </div>
            </label>

            <div className="field-blk">
              <span className="field-label">Reino</span>
              <div className="pick-grid c2">
                {REINOS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    className={`pick-btn${reino === r ? ' on' : ''}`}
                    onClick={() => setReino(r)}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            <div className="field-blk">
              <span className="field-label">Servidor</span>
              <div className="pick-grid c2">
                {SERVIDORES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className={`pick-btn${servidor === s ? ' on' : ''}`}
                    onClick={() => setServidor(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {erro && <p className="lp-erro">{erro}</p>}

            <button type="button" className="lp-btn-primario full cinzel" disabled={enviando} onClick={ativar}>
              {enviando ? 'Ativando…' : 'Ativar guilda'}
            </button>
            <button type="button" className="btn-ghost full" onClick={() => setAberto(null)}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {aberto === 'acessar' && (
        <div className="lp-overlay" role="dialog" aria-modal="true" aria-label="Acessar guilda existente">
          <div className="lp-modal">
            <h2 className="cinzel">Acessar guilda</h2>
            <label className="field-blk">
              <span className="field-label">Link da guilda</span>
              <div className="lp-slug">
                <span className="lp-slug-pre">/</span>
                <input
                  className="field-input"
                  value={slugBusca}
                  onChange={(e) => setSlugBusca(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') acessar();
                  }}
                  placeholder="imperium"
                />
              </div>
            </label>
            <button type="button" className="lp-btn-primario full cinzel" onClick={acessar}>
              Entrar
            </button>
            <button type="button" className="btn-ghost full" onClick={() => setAberto(null)}>
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
