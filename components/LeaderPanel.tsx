'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api-client';
import type { WarListsDTO } from '@/lib/types';
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
    <section className="mt-4 rounded-2xl border border-amber-400/30 bg-slate-900 p-4">
      <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-amber-300">Visão do líder</h2>

      {summary.alerts.length > 0 && (
        <div className="mb-3 flex flex-col gap-1">
          {summary.alerts.map((a) => (
            <p key={a} className="rounded-lg bg-red-950 px-3 py-2 text-sm text-red-300">
              ⚠️ {a}
            </p>
          ))}
        </div>
      )}

      <div className="grid grid-cols-3 gap-2 text-center">
        {combos.map(([k, v]) => (
          <div key={k} className="rounded-lg bg-slate-800 p-2">
            <p className="text-xs text-slate-400">{k.replace('_', ' ')}</p>
            <p className="text-lg font-bold">{v}</p>
          </div>
        ))}
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 text-center">
        <div className="rounded-lg bg-slate-800 p-2">
          <p className="text-xs text-slate-400">TOTAL FÍSICO</p>
          <p className="text-lg font-bold">{summary.TOTAL_FISICO as number}</p>
        </div>
        <div className="rounded-lg bg-slate-800 p-2">
          <p className="text-xs text-slate-400">TOTAL MAGO</p>
          <p className="text-lg font-bold">{summary.TOTAL_MAGO as number}</p>
        </div>
      </div>

      {locked && lists.vou.length > 0 && (
        <div className="mt-4">
          <h3 className="mb-2 text-sm font-semibold text-slate-300">Check de participação (+5 pts)</h3>
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
