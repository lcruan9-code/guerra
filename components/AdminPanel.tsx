'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api-client';
import { TIPO_LABELS } from '@/lib/wyd';
import type { AdminOverviewDTO, AwardDTO, RosterEntryDTO } from '@/lib/admin-types';
import LeaderUnlockCard from './LeaderUnlockCard';

type Tab = 'guerra' | 'premios' | 'jogadores';
type Gate = 'loading' | 'locked' | 'nologin' | 'ok';

export default function AdminPanel() {
  const [data, setData] = useState<AdminOverviewDTO | null>(null);
  const [gate, setGate] = useState<Gate>('loading');
  const [tab, setTab] = useState<Tab>('guerra');

  const load = useCallback(async () => {
    try {
      setData(await api<AdminOverviewDTO>('/api/admin/overview'));
      setGate('ok');
    } catch (e) {
      if (e instanceof ApiError && e.status === 403) setGate('locked');
      else setGate('nologin');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (gate === 'loading') return <div className="center-screen">Carregando painel…</div>;

  if (gate === 'nologin') {
    return (
      <div className="center-screen" style={{ flexDirection: 'column', gap: 12 }}>
        <p>Faça login para acessar o painel.</p>
        <a href="/" className="btn-ghost">Voltar</a>
      </div>
    );
  }

  if (gate === 'locked') {
    return (
      <div className="admin-wrap">
        <header className="admin-top">
          <div className="admin-title">⚙️ Painel do Líder</div>
          <a href="/" className="btn-ghost">Voltar</a>
        </header>
        <LeaderUnlockCard onDone={load} />
      </div>
    );
  }

  if (!data) return <div className="center-screen">Carregando painel…</div>;

  return (
    <div className="admin-wrap">
      <header className="admin-top">
        <div className="admin-title">⚙️ Painel do Líder</div>
        <a href="/" className="btn-ghost">Voltar</a>
      </header>

      <div className="tab-row">
        <button className={`tab-btn${tab === 'guerra' ? ' active' : ''}`} onClick={() => setTab('guerra')}>Guerra</button>
        <button className={`tab-btn${tab === 'premios' ? ' active' : ''}`} onClick={() => setTab('premios')}>Premiações</button>
        <button className={`tab-btn${tab === 'jogadores' ? ' active' : ''}`} onClick={() => setTab('jogadores')}>Jogadores</button>
      </div>

      {tab === 'guerra' && <GuerraTab data={data} reload={load} />}
      {tab === 'premios' && <PremiosTab data={data} reload={load} />}
      {tab === 'jogadores' && <JogadoresTab data={data} />}
    </div>
  );
}

/* ---------------- GUERRA ---------------- */
function GuerraTab({ data, reload }: { data: AdminOverviewDTO; reload: () => Promise<void> }) {
  const [torre, setTorre] = useState(data.warTimes.TORRE);
  const [noatum, setNoatum] = useState(data.warTimes.NOATUM);
  const [hint, setHint] = useState('');

  async function saveTimes() {
    setHint('');
    try {
      await api('/api/admin/war-times', { method: 'POST', body: JSON.stringify({ torre, noatum }) });
      setHint('Horários salvos.');
      await reload();
    } catch (e) {
      setHint(e instanceof ApiError ? e.message : 'Erro ao salvar.');
    }
  }

  const ev = data.nextEvent;
  const quando = new Date(ev.dataIso).toLocaleString('pt-BR', {
    weekday: 'long', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  });

  async function eventAction(action: string, dataIso?: string) {
    try {
      await api('/api/admin/event', { method: 'POST', body: JSON.stringify({ eventId: ev.id, action, dataIso }) });
      await reload();
    } catch {
      // silencioso; reload mostra estado real
    }
  }

  // valor para o input datetime-local no fuso SP
  const localValue = (() => {
    const d = new Date(new Date(ev.dataIso).getTime() - 3 * 3600 * 1000);
    return d.toISOString().slice(0, 16);
  })();
  const [novaData, setNovaData] = useState(localValue);

  return (
    <>
      <section className="admin-card">
        <h2>Horários padrão</h2>
        <div className="row-2">
          <div>
            <label className="mini-label">Torre (Seg–Sex)</label>
            <input className="field-input" type="time" value={torre} onChange={(e) => setTorre(e.target.value)} />
          </div>
          <div>
            <label className="mini-label">Noatum (Dom)</label>
            <input className="field-input" type="time" value={noatum} onChange={(e) => setNoatum(e.target.value)} />
          </div>
        </div>
        <div className="save-hint">{hint}</div>
        <button className="btn-primary" onClick={saveTimes}>Salvar horários</button>
      </section>

      <section className="admin-card">
        <h2>Próxima guerra</h2>
        <p style={{ fontWeight: 700, color: '#f0e6d2' }}>{TIPO_LABELS[ev.tipo as 'TORRE' | 'NOATUM']}</p>
        <p style={{ textTransform: 'capitalize', color: '#a89c87', fontSize: 14, marginTop: 2 }}>{quando}</p>
        {ev.cancelado && <p className="pill nao" style={{ marginTop: 8 }}>CANCELADA</p>}

        <div style={{ marginTop: 14 }}>
          <label className="mini-label">Remarcar data/hora</label>
          <div className="row-2">
            <input className="field-input" type="datetime-local" value={novaData} onChange={(e) => setNovaData(e.target.value)} />
            <button
              className="btn-ghost"
              onClick={() => eventAction('reschedule', new Date(`${novaData}:00-03:00`).toISOString())}
            >
              Remarcar
            </button>
          </div>
        </div>

        <div className="nav-row" style={{ marginTop: 14 }}>
          {ev.cancelado ? (
            <button className="btn-ghost accent" onClick={() => eventAction('restore')}>Reativar guerra</button>
          ) : (
            <button className="btn-ghost" onClick={() => eventAction('cancel')}>Cancelar esta guerra</button>
          )}
        </div>
      </section>

      <RosterCard data={data} reload={reload} />
      <SenhaCard />
    </>
  );
}

/* ---------------- SENHA DO LÍDER ---------------- */
function SenhaCard() {
  const [nova, setNova] = useState('');
  const [hint, setHint] = useState('');

  async function save() {
    setHint('');
    try {
      await api('/api/leader/password', { method: 'POST', body: JSON.stringify({ nova }) });
      setNova('');
      setHint('Senha alterada. Os outros dispositivos precisarão entrar de novo.');
    } catch (e) {
      setHint(e instanceof ApiError ? e.message : 'Erro ao salvar.');
    }
  }

  return (
    <section className="admin-card">
      <h2>Senha do líder</h2>
      <label className="mini-label">Nova senha (mín. 4 caracteres)</label>
      <input
        className="field-input"
        type="text"
        value={nova}
        onChange={(e) => setNova(e.target.value)}
        placeholder="Nova senha do líder"
      />
      <div className="save-hint">{hint}</div>
      <button className="btn-primary" disabled={nova.trim().length < 4} onClick={save}>
        Alterar senha
      </button>
    </section>
  );
}

/* ---------------- ROSTER + STATS ---------------- */
function RosterCard({ data, reload }: { data: AdminOverviewDTO; reload: () => Promise<void> }) {
  const eventId = data.nextEvent.id;
  const vou = data.roster.filter((r) => r.status === 'VOU');
  const counts = {
    vou: data.roster.filter((r) => r.status === 'VOU').length,
    talvez: data.roster.filter((r) => r.status === 'TALVEZ').length,
    nao: data.roster.filter((r) => r.status === 'NAO_VOU').length,
  };

  return (
    <section className="admin-card">
      <h2>Presença & lançamento (KS / Kefra)</h2>
      <p style={{ fontSize: 13, color: '#a89c87', marginBottom: 12 }}>
        <span className="pill vou">{counts.vou} vão</span>{' '}
        <span className="pill talvez">{counts.talvez} talvez</span>{' '}
        <span className="pill nao">{counts.nao} não</span>
      </p>
      {vou.length === 0 ? (
        <p className="empty-hint">Ninguém confirmou presença ainda.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>Jogador</th>
                <th>Foi?</th>
                <th>KS</th>
                <th>Kefra</th>
              </tr>
            </thead>
            <tbody>
              {vou.map((r) => (
                <StatsRow key={r.userId} eventId={eventId} entry={r} reload={reload} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function StatsRow({ eventId, entry, reload }: { eventId: string; entry: RosterEntryDTO; reload: () => Promise<void> }) {
  const [ks, setKs] = useState(String(entry.ks));
  const [kefra, setKefra] = useState(String(entry.kefra));

  async function save(patch: { participou?: boolean; ks?: number; kefra?: number }) {
    try {
      await api('/api/admin/stats', { method: 'POST', body: JSON.stringify({ eventId, userId: entry.userId, ...patch }) });
      if (patch.participou !== undefined) await reload();
    } catch {
      // silencioso
    }
  }

  return (
    <tr>
      <td className="nome">
        {entry.nome}
        {entry.personagem && (
          <div style={{ fontSize: 11, color: '#8a7f6e', fontWeight: 400 }}>
            {entry.personagem} · {entry.classe}
          </div>
        )}
      </td>
      <td className="check-cell" onClick={() => save({ participou: !(entry.participou ?? false) })}>
        <span className={`pill ${entry.participou ? 'vou' : 'nao'}`}>{entry.participou ? '✔' : '—'}</span>
      </td>
      <td className="num">
        <input
          className="stat-input"
          inputMode="numeric"
          value={ks}
          onChange={(e) => setKs(e.target.value.replace(/\D/g, ''))}
          onBlur={() => save({ ks: Number(ks || 0) })}
        />
      </td>
      <td className="num">
        <input
          className="stat-input"
          inputMode="numeric"
          value={kefra}
          onChange={(e) => setKefra(e.target.value.replace(/\D/g, ''))}
          onBlur={() => save({ kefra: Number(kefra || 0) })}
        />
      </td>
    </tr>
  );
}

/* ---------------- PREMIAÇÕES ---------------- */
function PremiosTab({ data, reload }: { data: AdminOverviewDTO; reload: () => Promise<void> }) {
  const [inicio, setInicio] = useState(data.week.inicio);
  const [fim, setFim] = useState(data.week.fim);
  const [texto, setTexto] = useState(data.week.texto);
  const [hint, setHint] = useState('');

  async function saveWeek() {
    setHint('');
    try {
      await api('/api/admin/week', { method: 'POST', body: JSON.stringify({ inicio, fim, texto }) });
      setHint('Semana salva.');
      await reload();
    } catch (e) {
      setHint(e instanceof ApiError ? e.message : 'Erro ao salvar.');
    }
  }

  return (
    <>
      <section className="admin-card">
        <h2>Semana da premiação</h2>
        <div className="row-2">
          <div>
            <label className="mini-label">Início</label>
            <input className="field-input" type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} />
          </div>
          <div>
            <label className="mini-label">Fim</label>
            <input className="field-input" type="date" value={fim} onChange={(e) => setFim(e.target.value)} />
          </div>
        </div>
        <div style={{ marginTop: 12 }}>
          <label className="mini-label">Aviso da premiação (opcional)</label>
          <input
            className="field-input"
            value={texto}
            maxLength={200}
            placeholder="Ex.: Premiação paga sábado no CL"
            onChange={(e) => setTexto(e.target.value)}
          />
        </div>
        <div className="save-hint">{hint}</div>
        <button className="btn-primary" onClick={saveWeek}>Salvar semana</button>
      </section>

      <section className="admin-card">
        <h2>Prêmios</h2>
        <div className="award-grid">
          {data.awards.map((a) => (
            <AwardCard key={a.key} award={a} reload={reload} />
          ))}
        </div>
      </section>
    </>
  );
}

function AwardCard({ award, reload }: { award: AwardDTO; reload: () => Promise<void> }) {
  const [ativo, setAtivo] = useState(award.ativo);
  const [premio, setPremio] = useState(award.premio);

  async function patch(body: { ativo?: boolean; premio?: string }) {
    try {
      await api('/api/admin/awards', { method: 'POST', body: JSON.stringify({ key: award.key, ...body }) });
      if (body.ativo !== undefined) await reload();
    } catch {
      // silencioso
    }
  }

  function toggle() {
    const next = !ativo;
    setAtivo(next);
    void patch({ ativo: next });
  }

  return (
    <div className={`award-box ${ativo ? 'on' : 'off'}`}>
      <div className="award-head">
        <span className="award-name">{award.label}</span>
        <label className="switch">
          <input type="checkbox" checked={ativo} onChange={toggle} />
          <span className="track" />
          <span className="thumb" />
        </label>
      </div>
      <input
        className="field-input"
        style={{ fontSize: 14, padding: '9px 11px' }}
        value={premio}
        maxLength={120}
        placeholder="Prêmio (ex.: 5kk)"
        onChange={(e) => setPremio(e.target.value)}
        onBlur={() => patch({ premio })}
      />
    </div>
  );
}

/* ---------------- JOGADORES ---------------- */
function JogadoresTab({ data }: { data: AdminOverviewDTO }) {
  return (
    <section className="admin-card">
      <h2>Jogadores ({data.players.length})</h2>
      <div style={{ overflowX: 'auto' }}>
        <table className="tbl">
          <thead>
            <tr>
              <th>Jogador</th>
              <th className="num">Pontos</th>
              <th className="num">Presenças</th>
            </tr>
          </thead>
          <tbody>
            {data.players.map((p) => (
              <tr key={p.userId}>
                <td className="nome">
                  {p.nome} {p.role === 'ADMIN' && <span className="pill admin">líder</span>}
                </td>
                <td className="num">{p.pontos}</td>
                <td className="num">{p.presencas}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
