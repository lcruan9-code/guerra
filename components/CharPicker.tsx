'use client';

import { SPEC_LABELS } from '@/lib/wyd';
import { classeEdge } from '@/lib/brand';
import type { CharacterDTO } from '@/lib/types';

interface Props {
  characters: CharacterDTO[];
  preselectedId: string | null;
  onPick: (id: string) => void;
  onClose: () => void;
}

export default function CharPicker({ characters, preselectedId, onPick, onClose }: Props) {
  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <h2 className="sheet-title">Com qual personagem?</h2>
        {characters.map((c) => (
          <button
            key={c.id}
            onClick={() => onPick(c.id)}
            className={`char-opt${c.id === preselectedId ? ' on' : ''}`}
            style={{ '--edge': classeEdge(c.classe) } as React.CSSProperties}
          >
            <span className="nome">{c.nome}</span>
            <span className="meta" style={{ color: classeEdge(c.classe) }}>
              {c.classe} · {SPEC_LABELS[c.especializacao]}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
