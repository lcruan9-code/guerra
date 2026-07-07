'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api-client';
import { TIPO_LABELS } from '@/lib/wyd';
import type { AdminOverviewDTO, AwardDTO, DayViewDTO, EventListItemDTO } from '@/lib/admin-types';
import LeaderUnlockCard from './LeaderUnlockCard';

const DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
function dayLabel(dia: string): string {
  const [y, m, d] = dia.split('-').map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${DIAS[dow]} ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`;
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
  const [durTorre, setDurTorre] = useState(String(data.warDurations.TORRE));
  const [durKefra, setDurKefra] = useState(String(data.warDurations.KEFRA));
  const [hint, setHint] = useState('');

  async function saveTimes() {
    setHint('');
    try {
      await api('/api/admin/war-times', {
        method: 'POST',
        body: JSON.stringify({ torre, kefra, durTorre: Number(durTorre), durKefra: Number(durKefra) }),
      });
      setHint('Horários salvos e aplicados às próximas guerras.');
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
            <label className="mini-label">Torre — início (Seg–Sex)</label>
            <input className="field-input" type="time" value={torre} onChange={(e) => setTorre(e.target.value)} />
          </div>
          <div>
            <label className="mini-label">Torre — duração (min)</label>
            <input className="field-input" type="number" min={1} max={180} value={durTorre} onChange={(e) => setDurTorre(e.target.value)} />
          </div>
        </div>
        <div className="row-2" style={{ marginTop: 10 }}>
          <div>
            <label className="mini-label">Kefra — início (Ter)</label>
            <input className="field-input" type="time" value={kefra} onChange={(e) => setKefra(e.target.value)} />
          </div>
          <div>
            <label className="mini-label">Kefra — tempo máx. (min)</label>
            <input className="field-input" type="number" min={1} max={180} value={durKefra} onChange={(e) => setDurKefra(e.target.value)} />
          </div>
        </div>
        <p style={{ fontSize: 12, color: '#8a7f6e', marginTop: 8 }}>
          Salvar já aplica às guerras que ainda não começaram. Torre encerra sozinha no fim da duração;
          Kefra é mob: encerra no botão “Kefra morto” ou ao atingir o tempo máx.
        </p>
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

/* ---------------- PRESENÇA & KS (por dia, combinado) ---------------- */
function RosterCard({ data, reload }: { data: AdminOverviewDTO; reload: () => Promise<void> }) {
  const [events, setEvents] = useState<EventListItemDTO[]>([]);
  const [dia, setDia] = useState<string>('');
  const [view, setView] = useState<DayViewDTO | null>(null);

  useEffect(() => {
    api<EventListItemDTO[]>('/api/admin/events')
      .then((evs) => {
        setEvents(evs);
        const hojeDia = evs.find((e) => e.id === data.nextEvent.id)?.dia ?? evs[0]?.dia ?? '';
        setDia(hojeDia);
      })
      .catch(() => setEvents([]));
  }, [data.nextEvent.id]);

  const loadDay = useCallback(async (d: string) => {
    if (!d) return;
    try {
      setView(await api<DayViewDTO>(`/api/admin/day?dia=${d}`));
    } catch {
      setView(null);
    }
  }, []);

  useEffect(() => {
    void loadDay(dia);
  }, [dia, loadDay]);

  async function toggleParticipou(eventId: string, userId: string, participou: boolean) {
    try {
      await api('/api/admin/stats', { method: 'POST', body: JSON.stringify({ eventId, userId, participou }) });
      await loadDay(dia);
      await reload();
    } catch {
      /* silencioso */
    }
  }

  async function changeKs(eventId: string, userId: string, value: number) {
    if (value < 0) return;
    try {
      await api('/api/admin/ks', { method: 'POST', body: JSON.stringify({ eventId, userId, ks: value }) });
      await loadDay(dia);
      await reload();
    } catch (e) {
      alert(e instanceof ApiError ? e.message : 'Erro ao lançar KS.');
      await loadDay(dia);
    }
  }

  // dias únicos (a partir da lista de eventos), rótulo pt-BR
  const dias = [...new Set(events.map((e) => e.dia))];
  const hojeDia = events.find((e) => e.id === data.nextEvent.id)?.dia ?? '';

  return (
    <section className="admin-card">
      <h2>Presença &amp; KS</h2>

      <label className="mini-label">Dia</label>
      <select className="field-input" value={dia} onChange={(e) => setDia(e.target.value)}>
        {dias.map((d) => {
          const doDia = events.filter((e) => e.dia === d);
          const tipos = doDia.map((e) => (e.tipo === 'KEFRA' ? 'Kefra' : 'Torre')).join(' + ');
          return (
            <option key={d} value={d}>
              {dayLabel(d)} · {tipos}
              {d === hojeDia ? ' · HOJE' : ''}
            </option>
          );
        })}
      </select>

      {!view || view.rows.length === 0 ? (
        <p className="empty-hint" style={{ marginTop: 14 }}>Ninguém confirmou presença neste dia.</p>
      ) : (
        <>
          {dia !== hojeDia && (
            <p style={{ fontSize: 12, color: '#e0a35a', margin: '10px 0' }}>
              ⚑ Dia anterior — lançando presença/KS retroativo.
            </p>
          )}
          <div style={{ overflowX: 'auto', marginTop: 12 }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Jogador</th>
                  {view.wars.map((w) => (
                    <th key={`f-${w.id}`}>Foi {w.tipo === 'KEFRA' ? 'Kef' : 'Torre'}?</th>
                  ))}
                  {view.wars.map((w) => (
                    <th key={`k-${w.id}`}>{w.tipo === 'KEFRA' ? 'KS Kef' : 'KS'}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {view.rows.map((r) => (
                  <tr key={r.userId}>
                    <td className="nome">
                      {r.nome}
                      {r.personagem && (
                        <div style={{ fontSize: 11, color: '#8a7f6e', fontWeight: 400 }}>
                          {r.personagem} · {r.classe}
                        </div>
                      )}
                    </td>

                    {view.wars.map((w) => {
                      const cell = r.cells[w.id];
                      if (!cell) return <td key={`f-${w.id}`} className="num" style={{ color: '#4a4436' }}>·</td>;
                      return (
                        <td
                          key={`f-${w.id}`}
                          className="check-cell"
                          onClick={() => toggleParticipou(w.id, r.userId, !(cell.participou ?? false))}
                        >
                          <span className={`pill ${cell.participou ? 'vou' : 'nao'}`}>{cell.participou ? '✔' : '—'}</span>
                        </td>
                      );
                    })}

                    {view.wars.map((w) => {
                      const cell = r.cells[w.id];
                      if (!cell) return <td key={`k-${w.id}`} className="num" style={{ color: '#4a4436' }}>·</td>;
                      const ks = cell.ks;
                      if (w.ksCap === 1) {
                        return (
                          <td
                            key={`k-${w.id}`}
                            className="check-cell"
                            onClick={() => changeKs(w.id, r.userId, ks > 0 ? 0 : 1)}
                          >
                            <span className={`pill ${ks > 0 ? 'vou' : 'nao'}`}>{ks > 0 ? '✔' : '—'}</span>
                          </td>
                        );
                      }
                      const canAdd = w.ksTotal < w.ksCap && ks < w.ksCap;
                      return (
                        <td key={`k-${w.id}`}>
                          <div className="ks-stepper">
                            <button className="ks-step" disabled={ks <= 0} onClick={() => changeKs(w.id, r.userId, ks - 1)}>
                              −
                            </button>
                            <span className={`ks-val${ks > 0 ? ' on' : ''}`}>{ks}</span>
                            <button className="ks-step" disabled={!canAdd} onClick={() => changeKs(w.id, r.userId, ks + 1)}>
                              +
                            </button>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {view.wars.map((w) => {
            if (w.ksCap !== 1) return null;
            const holder = view.rows.find((r) => (r.cells[w.id]?.ks ?? 0) > 0);
            return (
              <p key={`note-${w.id}`} style={{ fontSize: 12, color: '#8a7f6e', marginTop: 10 }}>
                {w.ksLabel}: {holder ? <strong style={{ color: '#ffd9a8' }}>{holder.nome}</strong> : 'outra guild / ninguém'} — clique no ★ de novo para tirar (outra guild pegou).
              </p>
            );
          })}
          {view.wars.some((w) => w.ksCap > 1) && (
            <p style={{ fontSize: 12, color: '#8a7f6e', marginTop: 6 }}>
              Torre: até 3 KS por dia — uma pessoa pode pegar mais de um.
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
