'use client';

import { useCallback, useState } from 'react';
import { api, ApiError } from '@/lib/api-client';
import type { GuildDTO, LicenseDTO, LicensePlan } from '@/lib/types';

type GuildComTotais = GuildDTO & { charactersCount: number; membersCount: number };
interface MasterData {
  licenses: LicenseDTO[];
  guilds: GuildComTotais[];
}

const PLANOS: LicensePlan[] = ['MENSAL', 'TRIMESTRAL', 'SEMESTRAL', 'VITALICIO'];

function dataBR(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR');
}

function ChaveRow({ lic }: { lic: LicenseDTO }) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(lic.key);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1500);
    } catch {
      setCopiado(false);
    }
  }

  return (
    <tr>
      <td>
        <code className="mp-key">{lic.key}</code>
        <button type="button" className="btn-ghost mp-copy" onClick={copiar}>
          {copiado ? 'copiado!' : 'copiar'}
        </button>
      </td>
      <td>{lic.plano}</td>
      <td>
        <span className={`mp-status mp-${lic.status.toLowerCase()}`}>{lic.status}</span>
      </td>
      <td>{lic.guild_nome ?? '—'}</td>
      <td>{dataBR(lic.valida_ate)}</td>
    </tr>
  );
}

export default function MasterPanel() {
  // A master key fica só em memória — nunca em localStorage.
  const [masterKey, setMasterKey] = useState('');
  const [data, setData] = useState<MasterData | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [plano, setPlano] = useState<LicensePlan>('MENSAL');
  const [gerando, setGerando] = useState(false);

  const carregar = useCallback(
    async (chave: string) => {
      setCarregando(true);
      setErro(null);
      try {
        const res = await api<MasterData>('/api/master/licenses', {
          headers: { Authorization: `Bearer ${chave}` },
        });
        setData(res);
      } catch (e) {
        setData(null);
        setErro(e instanceof ApiError ? e.message : 'Não foi possível carregar o painel.');
      } finally {
        setCarregando(false);
      }
    },
    [],
  );

  async function gerar() {
    setGerando(true);
    setErro(null);
    try {
      await api<LicenseDTO>('/api/master/licenses', {
        method: 'POST',
        headers: { Authorization: `Bearer ${masterKey}` },
        body: JSON.stringify({ plano }),
      });
      await carregar(masterKey);
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : 'Não foi possível gerar a chave.');
    } finally {
      setGerando(false);
    }
  }

  if (!data) {
    return (
      <div className="center-screen">
        <div className="mp-login">
          <h1 className="cinzel">Administrador Geral</h1>
          <label className="field-blk">
            <span className="field-label">Master Key</span>
            <input
              className="field-input"
              type="password"
              value={masterKey}
              onChange={(e) => setMasterKey(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void carregar(masterKey);
              }}
              placeholder="chave mestra"
              autoComplete="off"
            />
          </label>
          {erro && <p className="lp-erro">{erro}</p>}
          <button
            type="button"
            className="lp-btn-primario full cinzel"
            disabled={carregando || !masterKey}
            onClick={() => void carregar(masterKey)}
          >
            {carregando ? 'Entrando…' : 'Entrar'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mp">
      <header className="mp-head">
        <h1 className="cinzel">Painel Master</h1>
        <p className="muted">
          {data.guilds.length} guilda(s) · {data.licenses.length} chave(s)
        </p>
      </header>

      {erro && <p className="lp-erro">{erro}</p>}

      <section className="mp-card">
        <h2 className="cinzel">Gerar nova chave</h2>
        <div className="pick-grid c2">
          {PLANOS.map((p) => (
            <button
              key={p}
              type="button"
              className={`pick-btn${plano === p ? ' on' : ''}`}
              onClick={() => setPlano(p)}
            >
              {p}
            </button>
          ))}
        </div>
        <button type="button" className="lp-btn-primario cinzel mp-gerar" disabled={gerando} onClick={gerar}>
          {gerando ? 'Gerando…' : `Gerar chave ${plano}`}
        </button>
      </section>

      <section className="mp-card">
        <h2 className="cinzel">Chaves de licença</h2>
        <div className="mp-tabela-wrap">
          <table className="mp-tabela">
            <thead>
              <tr>
                <th>Chave</th>
                <th>Plano</th>
                <th>Status</th>
                <th>Guilda</th>
                <th>Válida até</th>
              </tr>
            </thead>
            <tbody>
              {data.licenses.map((l) => (
                <ChaveRow key={l.id} lic={l} />
              ))}
            </tbody>
          </table>
          {data.licenses.length === 0 && <p className="muted">Nenhuma chave gerada ainda.</p>}
        </div>
      </section>

      <section className="mp-card">
        <h2 className="cinzel">Guildas</h2>
        <div className="mp-tabela-wrap">
          <table className="mp-tabela">
            <thead>
              <tr>
                <th>Guilda</th>
                <th>Link</th>
                <th>Reino</th>
                <th>Servidor</th>
                <th>Membros</th>
                <th>Personagens</th>
                <th>Expira</th>
              </tr>
            </thead>
            <tbody>
              {data.guilds.map((g) => (
                <tr key={g.id} className={g.ativa ? undefined : 'mp-inativa'}>
                  <td>{g.nome}</td>
                  <td>
                    <a href={`/${g.slug}`} className="mp-link">/{g.slug}</a>
                  </td>
                  <td>{g.reino}</td>
                  <td>{g.servidor}</td>
                  <td>{g.membersCount}</td>
                  <td>{g.charactersCount}</td>
                  <td>{dataBR(g.valida_ate ?? null)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.guilds.length === 0 && <p className="muted">Nenhuma guilda cadastrada ainda.</p>}
        </div>
      </section>
    </div>
  );
}
