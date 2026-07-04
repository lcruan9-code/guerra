'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api-client';
import { TIPO_LABELS } from '@/lib/wyd';
import type { ConfirmStatus, WarListsDTO } from '@/lib/types';
import type { CurrentData } from './GuerraApp';
import Countdown from './Countdown';
import CharPicker from './CharPicker';
import WarLists from './WarLists';
import CharacterForm from './CharacterForm';
import LeaderPanel from './LeaderPanel';

const POLL_MS = 8000;

export default function WarScreen({ data, reload }: { data: CurrentData; reload: () => Promise<void> }) {
  const { user, event, myConfirmation, characters } = data;
  const [lists, setLists] = useState<WarListsDTO>({ vou: [], talvez: [], nao_vou: [] });
  const [picking, setPicking] = useState(false);
  const [managing, setManaging] = useState(false);
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

  const btn = (active: boolean, color: string) =>
    `rounded-2xl py-5 text-lg font-bold active:scale-95 disabled:opacity-40 ${active ? color : 'bg-slate-800'}`;

  return (
    <main className="mx-auto min-h-dvh max-w-md p-4 pb-16">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-400">Olá, {user.nome}</p>
          <p className="text-xs text-amber-300">{user.pontos} pontos</p>
        </div>
        <button onClick={() => setManaging(true)} className="rounded-lg bg-slate-800 px-3 py-2 text-sm">
          Meus personagens
        </button>
      </header>

      <section className="rounded-2xl bg-gradient-to-b from-slate-800 to-slate-900 p-5 text-center">
        <h1 className="text-xl font-bold">{TIPO_LABELS[event.tipo]}</h1>
        <p className="mt-1 text-sm capitalize text-slate-400">{dataLocal}</p>
        <div className="mt-3">
          <Countdown targetIso={event.dataIso} />
        </div>
      </section>

      {event.locked ? (
        <p className="mt-4 rounded-xl bg-slate-800 p-4 text-center text-slate-300">
          ⚔️ Guerra em andamento — confirmações encerradas.
        </p>
      ) : (
        <div className="mt-4 grid grid-cols-3 gap-2">
          <button className={btn(myConfirmation?.status === 'VOU', 'bg-emerald-500 text-slate-950')} onClick={onVou}>
            ✅ Vou
          </button>
          <button
            className={btn(myConfirmation?.status === 'NAO_VOU', 'bg-red-500 text-slate-950')}
            onClick={() => void send('NAO_VOU', null)}
          >
            ❌ Não vou
          </button>
          <button
            className={btn(myConfirmation?.status === 'TALVEZ', 'bg-amber-400 text-slate-900')}
            onClick={() => void send('TALVEZ', null)}
          >
            ⏳ Talvez
          </button>
        </div>
      )}
      {error && <p className="mt-2 text-center text-sm text-red-400">{error}</p>}

      {user.role === 'ADMIN' && (
        <LeaderPanel eventId={event.id} locked={event.locked} lists={lists} onParticipationChanged={loadLists} />
      )}

      <WarLists lists={lists} />

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
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950 p-6">
          <h2 className="mb-4 text-xl font-bold">Meus personagens</h2>
          {characters.map((c) => (
            <div key={c.id} className="mb-6 rounded-xl bg-slate-900 p-4">
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
            <div className="mb-6 rounded-xl bg-slate-900 p-4">
              <p className="mb-3 text-sm text-slate-400">Adicionar 2º personagem</p>
              <CharacterForm
                onSaved={() => {
                  setManaging(false);
                  void reload();
                }}
              />
            </div>
          )}
          <button onClick={() => setManaging(false)} className="w-full rounded-xl bg-slate-800 py-3">
            Fechar
          </button>
          <div className="mt-6 text-center">
            <button
              onClick={() => void api('/api/auth/logout', { method: 'POST' }).then(() => window.location.reload())}
              className="text-sm text-slate-500 underline"
            >
              Sair da conta
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
