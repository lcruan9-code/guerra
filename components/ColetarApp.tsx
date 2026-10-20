'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api-client';
import type { HeldAccountDTO, PublicAccountDTO } from '@/lib/types';

const SERVIDORES = ['INFINITY', 'ROGUE'] as const;

function Credencial({ label, valor }: { label: string; valor: string }) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(valor);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1500);
    } catch {
      setCopiado(false);
    }
  }

  return (
    <div className="cred-row">
      <span className="cred-label">{label}</span>
      <code className="cred-valor">{valor}</code>
      <button type="button" className="btn-ghost cred-copy" onClick={copiar}>
        {copiado ? 'copiado!' : 'copiar'}
      </button>
    </div>
  );
}

export default function ColetarApp() {
  const [minha, setMinha] = useState<HeldAccountDTO | null>(null);
  const [contas, setContas] = useState<PublicAccountDTO[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);

  const [nome, setNome] = useState('');
  const [origem, setOrigem] = useState<string>(SERVIDORES[0]);
  const [filtro, setFiltro] = useState<string>('');

  const load = useCallback(async () => {
    setErro(null);
    try {
      const [mine, lista] = await Promise.all([
        api<HeldAccountDTO | null>('/api/public/mine'),
        api<PublicAccountDTO[]>(`/api/public/accounts${filtro ? `?servidor=${filtro}` : ''}`),
      ]);
      setMinha(mine);
      setContas(lista);
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : 'Não foi possível carregar as contas.');
    } finally {
      setCarregando(false);
    }
  }, [filtro]);

  useEffect(() => {
    void load();
  }, [load]);

  async function pegar(id: string) {
    if (!nome.trim()) {
      setErro('Escreva o seu nome antes de pegar uma conta.');
      return;
    }
    setOcupado(id);
    setErro(null);
    try {
      await api(`/api/public/accounts/${id}/collect`, {
        method: 'POST',
        body: JSON.stringify({ nome_pessoa: nome.trim(), servidor_origem: origem }),
      });
      await load();
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : 'Não foi possível pegar essa conta.');
      await load();
    } finally {
      setOcupado(null);
    }
  }

  async function devolver(id: string) {
    setOcupado(id);
    setErro(null);
    try {
      await api(`/api/public/accounts/${id}/release`, { method: 'POST' });
      await load();
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : 'Não foi possível devolver a conta.');
    } finally {
      setOcupado(null);
    }
  }

  if (carregando) return <div className="center-screen">Carregando contas…</div>;

  const porTier = [1, 2, 3].map((t) => ({ tier: t, itens: contas.filter((c) => c.tier === t) }));

  return (
    <div className="coletar-wrap">
      <h1 className="cinzel set-titulo">Coleta de Contas</h1>

      {erro && <div className="coletar-erro">{erro}</div>}

      {minha ? (
        <section className="coletar-minha">
          <h2 className="cinzel">Você está com: {minha.personagem || minha.login}</h2>
          <p className="coletar-minha-cls">
            {minha.classe} · {minha.especializacao} · {minha.servidor}
          </p>
          <Credencial label="Login" valor={minha.login} />
          <Credencial label="Senha" valor={minha.senha} />
          <Credencial label="Senha interna" valor={minha.senha_interna} />
          <button
            type="button"
            className="btn-ghost full coletar-devolver"
            disabled={ocupado === minha.id}
            onClick={() => devolver(minha.id)}
          >
            {ocupado === minha.id ? 'Devolvendo…' : 'Devolver conta'}
          </button>
        </section>
      ) : (
        <section className="coletar-form">
          <label className="field-blk">
            <span className="field-label">Seu nome</span>
            <input
              className="field-input"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="como te chamam na guilda"
              maxLength={40}
            />
          </label>
          <label className="field-blk">
            <span className="field-label">Seu servidor de origem</span>
            <div className="pick-grid c2">
              {SERVIDORES.map((s) => (
                <button
                  key={s}
                  type="button"
                  className={`pick-btn${origem === s ? ' on' : ''}`}
                  onClick={() => setOrigem(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          </label>
          <p className="coletar-regra">Uma conta por pessoa. Devolva antes de pegar outra.</p>
        </section>
      )}

      <div className="coletar-filtro">
        <button type="button" className={`pick-btn${filtro === '' ? ' on' : ''}`} onClick={() => setFiltro('')}>
          Todos
        </button>
        {SERVIDORES.map((s) => (
          <button
            key={s}
            type="button"
            className={`pick-btn${filtro === s ? ' on' : ''}`}
            onClick={() => setFiltro(s)}
          >
            {s}
          </button>
        ))}
      </div>

      {contas.length === 0 && <p className="muted">Nenhuma conta disponível nesta guilda.</p>}

      {porTier.map(({ tier, itens }) =>
        itens.length === 0 ? null : (
          <section key={tier} className="coletar-tier">
            <h3 className="cinzel coletar-tier-titulo">Tier {tier}</h3>
            <div className="coletar-lista">
              {itens.map((c) => {
                const emUso = c.status === 'EM_USO';
                return (
                  <div key={c.id} className={`coletar-item${emUso ? ' usado' : ''}`}>
                    <div className="coletar-item-info">
                      <span className="coletar-item-nome">{c.personagem || '(sem nome)'}</span>
                      <span className="coletar-item-cls">
                        {c.classe} · {c.especializacao} · {c.servidor}
                      </span>
                    </div>
                    {emUso ? (
                      <span className="coletar-item-tag">com {c.taken_by ?? 'alguém'}</span>
                    ) : (
                      <button
                        type="button"
                        className="btn-ghost"
                        disabled={!!minha || ocupado === c.id}
                        onClick={() => pegar(c.id)}
                      >
                        {ocupado === c.id ? 'Pegando…' : 'Pegar'}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ),
      )}
    </div>
  );
}
