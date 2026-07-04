'use client';

import { SPEC_LABELS } from '@/lib/wyd';
import { classeEdge } from '@/lib/brand';
import type { ListEntry, WarListsDTO } from '@/lib/types';

interface Props {
  lists: WarListsDTO;
  leaderMode?: boolean;
  locked?: boolean;
  onParticipation?: (userId: string, participou: boolean) => void;
}

function Row({ e, leaderMode, locked, onParticipation }: { e: ListEntry } & Omit<Props, 'lists'>) {
  const edge = classeEdge(e.classe);
  return (
    <li className="list-row" style={{ '--edge': edge } as React.CSSProperties}>
      <div className="who">
        <div className="nome">{e.nome}</div>
        {e.personagem && (
          <div className="pj">
            {e.personagem} · <span className="class-tag" style={{ color: edge }}>{e.classe}</span>{' '}
            {e.especializacao ? SPEC_LABELS[e.especializacao] : ''}
          </div>
        )}
      </div>
      {leaderMode && locked && onParticipation && (
        <button
          onClick={() => onParticipation(e.userId, !(e.participou ?? false))}
          className={`part-btn${e.participou ? ' on' : ''}`}
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
      <h3 className="section-h">
        {title} <span className="count">({entries.length})</span>
        <span className="rule" />
      </h3>
      <ul className="list">
        {entries.map((e) => (
          <Row key={e.userId} e={e} {...rest} />
        ))}
      </ul>
    </section>
  );
}

export default function WarLists({ lists, leaderMode, locked, onParticipation }: Props) {
  const rest = { leaderMode, locked, onParticipation };
  const total = lists.vou.length + lists.talvez.length + lists.nao_vou.length;
  return (
    <div>
      <Section title="✅ Confirmados" entries={lists.vou} {...rest} />
      <Section title="⏳ Talvez" entries={lists.talvez} {...rest} />
      <Section title="❌ Não vão" entries={lists.nao_vou} {...rest} />
      {total === 0 && <p className="empty-hint">Ninguém respondeu ainda. Seja o primeiro!</p>}
    </div>
  );
}
