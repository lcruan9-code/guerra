'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api-client';
import { gearScore } from '@/lib/gear';
import type { CharacterDTO } from '@/lib/types';
import EquipmentGrid from './EquipmentGrid';
import LoginView from './LoginView';

type State =
  | { kind: 'loading' }
  | { kind: 'anon' }
  | { kind: 'ready'; chars: CharacterDTO[] };

export default function SetApp() {
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [editando, setEditando] = useState<CharacterDTO | null>(null);

  const load = useCallback(async () => {
    try {
      const chars = await api<CharacterDTO[]>('/api/characters');
      setState({ kind: 'ready', chars });
    } catch {
      setState({ kind: 'anon' });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (state.kind === 'loading') return <div className="center-screen">Carregando…</div>;
  if (state.kind === 'anon') return <LoginView onDone={load} />;

  if (state.chars.length === 0) {
    return (
      <div className="set-vazio">
        <p>Você ainda não tem personagem cadastrado.</p>
        <p className="muted">Cadastre um na aba Guerras para montar o SET.</p>
      </div>
    );
  }

  return (
    <div className="set-wrap">
      <h1 className="cinzel set-titulo">Montar SET</h1>
      <p className="set-sub">Toque num personagem para montar o equipamento e ver o Gear Score.</p>

      <div className="set-chars">
        {state.chars.map((c) => {
          const score = gearScore(c.equipment ?? {});
          return (
            <button key={c.id} type="button" className="set-char" onClick={() => setEditando(c)}>
              <span className="set-char-nome">{c.nome}</span>
              <span className="set-char-cls">{c.classe} · {c.especializacao}</span>
              <span className="set-char-score">
                <strong>{score}</strong><span className="set-char-max">/48</span>
              </span>
            </button>
          );
        })}
      </div>

      {editando && (
        <EquipmentGrid
          character={editando}
          onClose={() => setEditando(null)}
          onSaved={() => { setEditando(null); void load(); }}
        />
      )}
    </div>
  );
}
