'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import { api, ApiError } from '@/lib/api-client';
import { TIPO_LABELS } from '@/lib/wyd';
import { BRAND } from '@/lib/brand';
import type { ConfirmStatus, WarListsDTO } from '@/lib/types';
import type { CurrentData } from './GuerraApp';
import Countdown from './Countdown';
import CharPicker from './CharPicker';
import WarLists from './WarLists';
import CharacterForm from './CharacterForm';
import LeaderPanel from './LeaderPanel';
import RankingSheet from './RankingSheet';

const POLL_MS = 8000;

export default function WarScreen({ data, reload }: { data: CurrentData; reload: () => Promise<void> }) {
  const { user, event, myConfirmation, characters } = data;
  const [lists, setLists] = useState<WarListsDTO>({ vou: [], talvez: [], nao_vou: [] });
  const [picking, setPicking] = useState(false);
  const [managing, setManaging] = useState(false);
  const [ranking, setRanking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadLists = useCallback(async () => {
    try {
      setLists(await api<WarListsDTO>(`/api/war/${event.id}/list`));
    } catch {
      // polling: falha silenciosa, próxima rodada tenta de novo
    }
  }, [event.id]);

  useEffect(() => {
    void loadLists();
    const t = setInterval(() => void loadLists(), POLL_MS);
    return () => clearInterval(t);
  }, [loadLists]);

  async function send(status: ConfirmStatus, characterId: string | null) {
    setError(null);
    try {
      await api(`/api/war/${event.id}/confirm`, {
        method: 'POST',
        body: JSON.stringify({ status, characterId }),
      });
      await Promise.all([reload(), loadLists()]);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Erro ao confirmar.');
    }
  }

  function onVou() {
    if (characters.length === 1) {
      void send('VOU', characters[0].id);
      return;
    }
    setPicking(true);
  }

  const preselected = myConfirmation?.characterId ?? characters.find((c) => c.principal)?.id ?? null;

  const dataLocal = new Date(event.dataIso).toLocaleString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  });

  return (
    <div className="app-wrap">
      <header className="app-header">
        <div className="brand">
          <Image className="brand-logo" src="/guild-logo.png" alt={BRAND.guildName} width={46} height={46} />
          <div>
            <div className="brand-name">{BRAND.guildName}</div>
            <div className="brand-sub">
              GUERRA · <span className="reino">REINO {BRAND.reino}</span>
            </div>
          </div>
        </div>
        <div className="header-right">
          <div className="user-name">{user.nome}</div>
          <div className="user-points">{user.pontos} pontos</div>
        </div>
      </header>

      <section className="war-hero">
        <div className="war-kicker">Próxima guerra</div>
        <h1 className="war-title">{TIPO_LABELS[event.tipo]}</h1>
        <div className="war-when">{dataLocal}</div>
        <Countdown targetIso={event.dataIso} />
      </section>

      {event.locked ? (
        <p className="locked-banner">⚔️ Guerra em andamento — confirmações encerradas.</p>
      ) : (
        <div className="war-choices">
          <button className={`choice-btn vou${myConfirmation?.status === 'VOU' ? ' on' : ''}`} onClick={onVou}>
            <span className="ico">✅</span> Vou
          </button>
          <button
            className={`choice-btn nao${myConfirmation?.status === 'NAO_VOU' ? ' on' : ''}`}
            onClick={() => void send('NAO_VOU', null)}
          >
            <span className="ico">❌</span> Não vou
          </button>
          <button
            className={`choice-btn talvez${myConfirmation?.status === 'TALVEZ' ? ' on' : ''}`}
            onClick={() => void send('TALVEZ', null)}
          >
            <span className="ico">⏳</span> Talvez
          </button>
        </div>
      )}
      {error && <p className="error-text" style={{ marginTop: 12, textAlign: 'center' }}>{error}</p>}

      <div className="nav-row">
        <button className="btn-ghost accent" onClick={() => setRanking(true)}>
          🏆 Premiações
        </button>
        {user.role === 'ADMIN' && (
          <a className="btn-ghost" href="/admin">
            ⚙️ Painel
          </a>
        )}
        <button className="btn-ghost" onClick={() => setManaging(true)}>
          Personagens
        </button>
      </div>

      {user.role === 'ADMIN' && (
        <LeaderPanel eventId={event.id} locked={event.locked} lists={lists} onParticipationChanged={loadLists} />
      )}

      <div style={{ marginTop: 8 }}>
        <WarLists lists={lists} />
      </div>

      {ranking && <RankingSheet onClose={() => setRanking(false)} />}

      {picking && (
        <CharPicker
          characters={characters}
          preselectedId={preselected}
          onPick={(id) => {
            setPicking(false);
            void send('VOU', id);
          }}
          onClose={() => setPicking(false)}
        />
      )}

      {managing && (
        <div className="sheet-overlay" onClick={() => setManaging(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <h2 className="sheet-title">Meus personagens</h2>
            {characters.map((c) => (
              <div key={c.id} className="manage-block">
                <CharacterForm
                  initial={c}
                  onSaved={() => {
                    setManaging(false);
                    void reload();
                  }}
                />
              </div>
            ))}
            {characters.length < 2 && (
              <div className="manage-block">
                <div className="label">Adicionar 2º personagem</div>
                <CharacterForm
                  onSaved={() => {
                    setManaging(false);
                    void reload();
                  }}
                />
              </div>
            )}
            <button onClick={() => setManaging(false)} className="btn-ghost full" style={{ marginTop: 4 }}>
              Fechar
            </button>
            <div style={{ marginTop: 18, textAlign: 'center' }}>
              <button
                onClick={() => void api('/api/auth/logout', { method: 'POST' }).then(() => window.location.reload())}
                className="link-muted"
              >
                Sair da conta
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
