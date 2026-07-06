'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api-client';
import { TIPO_LABELS } from '@/lib/wyd';
import type { AdminOverviewDTO, AwardDTO, EventListItemDTO, RosterEntryDTO, RosterViewDTO } from '@/lib/admin-types';
import LeaderUnlockCard from './LeaderUnlockCard';

const DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
function warLabel(ev: { dia: string; tipo: string }): string {
  const [y, m, d] = ev.dia.split('-').map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  const tipo = ev.tipo === 'KEFRA' ? 'Kefra' : 'Torre';
  return `${DIAS[dow]} ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')} · ${tipo}`;
}

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
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn-ghost"
            onClick={() =>
              void api('/api/leader/lock', { method: 'POST' }).then(() => {
                window.location.href = '/';
              })
            }
          >
            🔒 Bloquear
          </button>
          <a href="/" className="btn-ghost">Voltar</a>
        </div>
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
  const [kefra, setKefra] = useState(data.warTimes.KEFRA);
  const [hint, setHint] = useState('');

  async function saveTimes() {
    setHint('');
    try {
      await api('/api/admin/war-times', { method: 'POST', body: JSON.stringify({ torre, kefra }) });
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
            <label className="mini-label">Kefra (Ter)</label>
            <input className="field-input" type="time" value={kefra} onChange={(e) => setKefra(e.target.value)} />
          </div>
        </div>
        <div className="save-hint">{hint}</div>
        <button className="btn-primary" onClick={saveTimes}>Salvar horários</button>
      </section>

      <section className="admin-card">
        <h2>Próxima guerra</h2>
        <p style={{ fontWeight: 700, color: '#f0e6d2' }}>{TIPO_LABELS[ev.tipo as 'TORRE' | 'KEFRA']}</p>
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

/* ---------------- ROSTER + STATS (com seletor de guerra) ---------------- */
function RosterCard({ data, reload }: { data: AdminOverviewDTO; reload: () => Promise<void> }) {
  const [events, setEvents] = useState<EventListItemDTO[]>([]);
  const [selectedId, setSelectedId] = useState(data.nextEvent.id);
  const [roster, setRoster] = useState<RosterEntryDTO[]>([]);
  const [ksLabel, setKsLabel] = useState<'KS' | 'Kefra'>('KS');
  const [ksCap, setKsCap] = useState(3);
  const [ksTotal, setKsTotal] = useState(0);

  useEffect(() => {
    api<EventListItemDTO[]>('/api/admin/events')
      .then(setEvents)
      .catch(() => setEvents([]));
  }, []);

  const loadRoster = useCallback(async (eventId: string) => {
    try {
      const view = await api<RosterViewDTO>(`/api/admin/roster?eventId=${eventId}`);
      setRoster(view.roster);
      setKsLabel(view.ksLabel);
      setKsCap(view.ksCap);
      setKsTotal(view.ksTotal);
    } catch {
      setRoster([]);
      setKsTotal(0);
    }
  }, []);

  useEffect(() => {
    void loadRoster(selectedId);
  }, [selectedId, loadRoster]);

  async function changeKs(userId: string, value: number) {
    if (value < 0) return;
    try {
      await api('/api/admin/ks', { method: 'POST', body: JSON.stringify({ eventId: selectedId, userId, ks: value }) });
      await loadRoster(selectedId);
      await reload();
    } catch (e) {
      alert(e instanceof ApiError ? e.message : 'Erro ao lançar KS.');
      await loadRoster(selectedId);
    }
  }

  async function toggleParticipou(userId: string, participou: boolean) {
    try {
      await api('/api/admin/stats', { method: 'POST', body: JSON.stringify({ eventId: selectedId, userId, participou }) });
      await loadRoster(selectedId);
      await reload();
    } catch {
      // silencioso
    }
  }

  const vou = roster.filter((r) => r.status === 'VOU');
  const counts = {
    vou: vou.length,
    talvez: roster.filter((r) => r.status === 'TALVEZ').length,
    nao: roster.filter((r) => r.status === 'NAO_VOU').length,
  };
  const hoje = data.nextEvent.id;
  const kefraMode = ksCap === 1; // Kefra: escolha única (ou outra guild)
  const holder = vou.find((r) => (r.ks ?? 0) > 0)?.userId ?? null;

  return (
    <section className="admin-card">
      <h2>Presença & KS</h2>

      <label className="mini-label">Guerra</label>
      <select className="field-input" value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
        {events.map((ev) => (
          <option key={ev.id} value={ev.id}>
            {warLabel(ev)}
            {ev.id === hoje ? ' · HOJE' : ''}
            {ev.cancelado ? ' · cancelada' : ''} — {ev.vou} vão / {ev.participou} foram
          </option>
        ))}
      </select>

      <p style={{ fontSize: 13, color: '#a89c87', margin: '12px 0' }}>
        <span className="pill vou">{counts.vou} vão</span>{' '}
        <span className="pill talvez">{counts.talvez} talvez</span>{' '}
        <span className="pill nao">{counts.nao} não</span>
      </p>

      {selectedId !== hoje && (
        <p style={{ fontSize: 12, color: '#e0a35a', marginBottom: 10 }}>
          ⚑ Guerra anterior. Marque quem foi e quantos {ksLabel} cada um deu.
        </p>
      )}

      {vou.length === 0 ? (
        <p className="empty-hint">Ninguém confirmou presença nesta guerra.</p>
      ) : (
        <>
          {kefraMode ? (
            <p style={{ fontSize: 13, color: '#a89c87', marginBottom: 8 }}>
              Quem deu o {ksLabel}:{' '}
              <strong style={{ color: holder ? '#ffd9a8' : '#9fb0e8' }}>
                {holder ? vou.find((r) => r.userId === holder)?.nome : 'Outra guild / ninguém'}
              </strong>
            </p>
          ) : (
            <p style={{ fontSize: 13, color: ksTotal >= ksCap ? '#7fd18f' : '#e0a35a', marginBottom: 8 }}>
              {ksLabel} lançados: <strong>{ksTotal}/{ksCap}</strong>
            </p>
          )}

          <div style={{ overflowX: 'auto' }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Jogador</th>
                  <th>Foi?</th>
                  <th>{ksLabel}</th>
                </tr>
              </thead>
              <tbody>
                {vou.map((r) => {
                  const ks = r.ks ?? 0;
                  const canAdd = ksTotal < ksCap && ks < ksCap;
                  return (
                    <tr key={r.userId}>
                      <td className="nome">
                        {r.nome}
                        {r.personagem && (
                          <div style={{ fontSize: 11, color: '#8a7f6e', fontWeight: 400 }}>
                            {r.personagem} · {r.classe}
                          </div>
                        )}
                      </td>
                      <td className="check-cell" onClick={() => toggleParticipou(r.userId, !(r.participou ?? false))}>
                        <span className={`pill ${r.participou ? 'vou' : 'nao'}`}>{r.participou ? '✔' : '—'}</span>
                      </td>
                      <td>
                        {kefraMode ? (
                          <button
                            className={`ks-radio${ks > 0 ? ' on' : ''}`}
                            onClick={() => changeKs(r.userId, ks > 0 ? 0 : 1)}
                          >
                            {ks > 0 ? '★ deu o KS' : 'marcar'}
                          </button>
                        ) : (
                          <div className="ks-stepper">
                            <button className="ks-step" disabled={ks <= 0} onClick={() => changeKs(r.userId, ks - 1)}>
                              −
                            </button>
                            <span className={`ks-val${ks > 0 ? ' on' : ''}`}>{ks}</span>
                            <button className="ks-step" disabled={!canAdd} onClick={() => changeKs(r.userId, ks + 1)}>
                              +
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {kefraMode ? (
            <>
              <button
                className={`ks-radio full${holder === null ? ' on' : ''}`}
                style={{ marginTop: 10 }}
                onClick={() => holder && changeKs(holder, 0)}
              >
                🛡️ Outra guild pegou o KS
              </button>
              <p style={{ fontSize: 12, color: '#8a7f6e', marginTop: 8 }}>
                O Kefra tem só 1 KS na semana — marque quem deu, ou &quot;outra guild&quot; se não foi nosso.
              </p>
            </>
          ) : (
            <p style={{ fontSize: 12, color: '#8a7f6e', marginTop: 10 }}>
              A Torre tem até 3 KS por dia — uma pessoa pode pegar mais de um.
            </p>
          )}
        </>
      )}
    </section>
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
