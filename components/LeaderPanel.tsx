'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api-client';
import { CLASSE_COLOR } from '@/lib/brand';
import type { Classe, WarListsDTO } from '@/lib/types';
import WarLists from './WarLists';

const POLL_MS = 8000;

type SummaryFlat = Record<string, number | string[]> & { alerts: string[] };

interface Props {
  eventId: string;
  locked: boolean;
  lists: WarListsDTO;
  onParticipationChanged: () => Promise<void>;
}

export default function LeaderPanel({ eventId, locked, lists, onParticipationChanged }: Props) {
  const [summary, setSummary] = useState<SummaryFlat | null>(null);

  const loadSummary = useCallback(async () => {
    try {
      setSummary(await api<SummaryFlat>(`/api/war/${eventId}/summary`));
    } catch {
      // polling: falha silenciosa
    }
  }, [eventId]);

  useEffect(() => {
    void loadSummary();
    const t = setInterval(() => void loadSummary(), POLL_MS);
    return () => clearInterval(t);
  }, [loadSummary]);

  async function toggleParticipation(userId: string, participou: boolean) {
    try {
      await api(`/api/war/${eventId}/participation`, {
        method: 'POST',
        body: JSON.stringify({ userId, participou }),
      });
      await onParticipationChanged();
    } catch {
      // erro pontual: próximo polling corrige a visão
    }
  }

  if (!summary) return null;

  const combos = Object.entries(summary).filter(
    ([k, v]) => typeof v === 'number' && k !== 'TOTAL_FISICO' && k !== 'TOTAL_MAGO',
  ) as [string, number][];

  return (
    <section className="leader-panel">
      <h2 className="leader-title">⚑ Visão do líder</h2>

      {summary.alerts.length > 0 && (
        <div className="alerts">
          {summary.alerts.map((a) => (
            <p key={a} className="alert">⚠️ {a}</p>
          ))}
        </div>
      )}

      {combos.length > 0 ? (
        <div className="comp-grid">
          {combos.map(([k, v]) => {
            const cls = k.split('_')[0] as Classe;
            const edge = CLASSE_COLOR[cls] ?? 'rgba(212,178,90,.4)';
            return (
              <div key={k} className="comp-cell" style={{ '--edge': edge } as React.CSSProperties}>
                <div className="k">{k.replace('_', ' ')}</div>
                <div className="v">{v}</div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="empty-hint">Nenhum confirmado ainda para compor.</p>
      )}

      <div className="totals">
        <div className="total-cell">
          <div className="k">Total Físico</div>
          <div className="v">{summary.TOTAL_FISICO as number}</div>
        </div>
        <div className="total-cell">
          <div className="k">Total Mago</div>
          <div className="v">{summary.TOTAL_MAGO as number}</div>
        </div>
      </div>

      {locked && lists.vou.length > 0 && (
        <div>
          <h3 className="leader-check-h">Check de participação (+5 pts)</h3>
          <WarLists
            lists={{ vou: lists.vou, talvez: [], nao_vou: [] }}
            leaderMode
            locked
            onParticipation={(userId, p) => void toggleParticipation(userId, p)}
          />
        </div>
      )}
    </section>
  );
}
