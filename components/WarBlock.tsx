'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api-client';
import { TIPO_LABELS } from '@/lib/wyd';
import type { CharacterDTO, ConfirmStatus, WarListsDTO } from '@/lib/types';
import type { WarDTO } from './GuerraApp';
import Countdown from './Countdown';
import CharPicker from './CharPicker';
import WarLists from './WarLists';
import LeaderPanel from './LeaderPanel';

const POLL_MS = 8000;

interface Props {
  war: WarDTO;
  characters: CharacterDTO[];
  leaderUnlocked: boolean;
  reloadCurrent: () => Promise<void>;
}

export default function WarBlock({ war, characters, leaderUnlocked, reloadCurrent }: Props) {
  const [lists, setLists] = useState<WarListsDTO>({ vou: [], talvez: [], nao_vou: [] });
  const [picking, setPicking] = useState(false);
  const [showLists, setShowLists] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A lista de presença é visível só para o líder — só ele carrega/atualiza.
  const loadLists = useCallback(async () => {
    if (!leaderUnlocked) return;
    try {
      setLists(await api<WarListsDTO>(`/api/war/${war.id}/list`));
    } catch {
      // polling: falha silenciosa
    }
  }, [war.id, leaderUnlocked]);

  useEffect(() => {
    if (!leaderUnlocked) return;
    void loadLists();
    const t = setInterval(() => void loadLists(), POLL_MS);
    return () => clearInterval(t);
  }, [loadLists, leaderUnlocked]);

  async function send(status: ConfirmStatus, characterId: string | null) {
    setError(null);
    try {
      await api(`/api/war/${war.id}/confirm`, {
        method: 'POST',
        body: JSON.stringify({ status, characterId }),
      });
      await Promise.all([reloadCurrent(), loadLists()]);
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

  async function finalizeWar() {
    setError(null);
    try {
      await api(`/api/war/${war.id}/finalize`, { method: 'POST' });
      await Promise.all([reloadCurrent(), loadLists()]);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Erro ao encerrar a guerra.');
    }
  }

  const preselected = war.myConfirmation?.characterId ?? characters.find((c) => c.principal)?.id ?? null;

  const dataLocal = new Date(war.dataIso).toLocaleString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  });

  const status = war.myConfirmation?.status;

  return (
    <div className="war-block">
      <section className="war-hero">
        <div className="war-kicker">{war.tipo === 'KEFRA' ? 'Evento da semana' : 'Próxima guerra'}</div>
        <h1 className="war-title">{TIPO_LABELS[war.tipo]}</h1>
        <div className="war-when">{dataLocal}</div>
        <Countdown targetIso={war.dataIso} ended={war.ended} />
      </section>

      {war.ended ? (
        <p className="locked-banner">🏁 Guerra encerrada.</p>
      ) : war.locked ? (
        <p className="locked-banner">⚔️ Em andamento — confirmações encerradas.</p>
      ) : (
        <div className="war-choices">
          <button className={`choice-btn vou${status === 'VOU' ? ' on' : ''}`} onClick={onVou}>
            <span className="ico">✅</span> Vou
          </button>
          <button className={`choice-btn nao${status === 'NAO_VOU' ? ' on' : ''}`} onClick={() => void send('NAO_VOU', null)}>
            <span className="ico">❌</span> Não vou
          </button>
          <button className={`choice-btn talvez${status === 'TALVEZ' ? ' on' : ''}`} onClick={() => void send('TALVEZ', null)}>
            <span className="ico">⏳</span> Talvez
          </button>
        </div>
      )}
      {error && <p className="error-text" style={{ marginTop: 12, textAlign: 'center' }}>{error}</p>}

      {leaderUnlocked && (
        <LeaderPanel
          eventId={war.id}
          tipo={war.tipo}
          locked={war.locked}
          ended={war.ended}
          lists={lists}
          onParticipationChanged={loadLists}
          onFinalize={finalizeWar}
        />
      )}

      {leaderUnlocked && (
        <div className="lists-collapse">
          <button
            className="lists-toggle"
            onClick={() => setShowLists((v) => !v)}
            aria-expanded={showLists}
          >
            <span className="lists-toggle-label">👥 Quem marcou</span>
            <span className="lists-counts">
              <span className="lc vou">✅ {lists.vou.length}</span>
              <span className="lc talvez">⏳ {lists.talvez.length}</span>
              <span className="lc nao">❌ {lists.nao_vou.length}</span>
            </span>
            <span className={`lists-chevron${showLists ? ' open' : ''}`}>▾</span>
          </button>
          {showLists && (
            <div style={{ marginTop: 10 }}>
              <WarLists lists={lists} />
            </div>
          )}
        </div>
      )}

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
    </div>
  );
}
