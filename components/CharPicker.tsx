'use client';

import { SPEC_LABELS } from '@/lib/wyd';
import type { CharacterDTO } from '@/lib/types';

interface Props {
  characters: CharacterDTO[];
  preselectedId: string | null;
  onPick: (id: string) => void;
  onClose: () => void;
}

export default function CharPicker({ characters, preselectedId, onPick, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/60" onClick={onClose}>
      <div className="w-full rounded-t-2xl bg-slate-900 p-6 pb-10" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-4 text-lg font-bold">Com qual personagem?</h2>
        <div className="flex flex-col gap-3">
          {characters.map((c) => (
            <button
              key={c.id}
              onClick={() => onPick(c.id)}
              className={`flex items-center justify-between rounded-xl px-4 py-4 text-left ${
                c.id === preselectedId ? 'bg-amber-400 text-slate-900' : 'bg-slate-800'
              }`}
            >
              <span className="text-lg font-semibold">{c.nome}</span>
              <span className="text-sm opacity-80">
                {c.classe} {SPEC_LABELS[c.especializacao]}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
