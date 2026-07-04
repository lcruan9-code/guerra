'use client';

import { SPEC_LABELS } from '@/lib/wyd';
import type { ListEntry, WarListsDTO } from '@/lib/types';

interface Props {
  lists: WarListsDTO;
  leaderMode?: boolean;
  locked?: boolean;
  onParticipation?: (userId: string, participou: boolean) => void;
}

function Row({ e, leaderMode, locked, onParticipation }: { e: ListEntry } & Omit<Props, 'lists'>) {
  return (
    <li className="flex items-center justify-between rounded-lg bg-slate-800/60 px-3 py-2">
      <div>
        <span className="font-medium">{e.nome}</span>
        {e.personagem && (
          <span className="ml-2 text-sm text-slate-400">
            {e.personagem} · {e.classe} {e.especializacao ? SPEC_LABELS[e.especializacao] : ''}
          </span>
        )}
      </div>
      {leaderMode && locked && onParticipation && (
        <button
          onClick={() => onParticipation(e.userId, !(e.participou ?? false))}
          className={`rounded-lg px-3 py-1 text-sm font-semibold ${
            e.participou ? 'bg-emerald-500 text-slate-950' : 'bg-slate-700 text-slate-300'
          }`}
        >
          {e.participou ? '✔ Participou' : 'Marcar'}
        </button>
      )}
    </li>
  );
}

function Section({ title, entries, ...rest }: { title: string; entries: ListEntry[] } & Omit<Props, 'lists'>) {
  if (entries.length === 0) return null;
  return (
    <section>
      <h3 className="mb-2 mt-4 text-sm font-semibold uppercase tracking-wide text-slate-400">
        {title} ({entries.length})
      </h3>
      <ul className="flex flex-col gap-1">
        {entries.map((e) => (
          <Row key={e.userId} e={e} {...rest} />
        ))}
      </ul>
    </section>
  );
}

export default function WarLists({ lists, leaderMode, locked, onParticipation }: Props) {
  const rest = { leaderMode, locked, onParticipation };
  return (
    <div>
      <Section title="✅ Confirmados" entries={lists.vou} {...rest} />
      <Section title="⏳ Talvez" entries={lists.talvez} {...rest} />
      <Section title="❌ Não vão" entries={lists.nao_vou} {...rest} />
    </div>
  );
}
