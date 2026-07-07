'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api-client';
import type { CharacterDTO, ConfirmStatus, Role, WarTipo } from '@/lib/types';
import CharacterWizard from './CharacterWizard';
import LoginView from './LoginView';
import WarScreen from './WarScreen';

export interface WarDTO {
  id: string;
  tipo: WarTipo;
  dataIso: string;
  endsIso: string | null;
  locked: boolean; // já começou (confirmações travadas)
  ended: boolean; // já encerrou (fim automático ou "Kefra morto")
  myConfirmation: { status: ConfirmStatus; characterId: string | null } | null;
}

export interface CurrentData {
  user: { nome: string; role: Role; pontos: number };
  characters: CharacterDTO[];
  leaderUnlocked: boolean;
  wars: WarDTO[];
}

type State = { kind: 'loading' } | { kind: 'anon' } | { kind: 'ready'; data: CurrentData };

export default function GuerraApp() {
  const [state, setState] = useState<State>({ kind: 'loading' });

  const load = useCallback(async () => {
    try {
      const data = await api<CurrentData>('/api/war/current');
      setState({ kind: 'ready', data });
    } catch {
      setState({ kind: 'anon' });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (state.kind === 'loading') {
    return <div className="center-screen">Carregando…</div>;
  }
  // Sem sessão: login pelo nome do personagem (ou cadastro se não existir).
  if (state.kind === 'anon') return <LoginView onDone={load} />;
  if (state.data.characters.length === 0) {
    return <CharacterWizard onDone={load} />;
  }
  return <WarScreen data={state.data} reload={load} />;
}
