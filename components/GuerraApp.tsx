'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api-client';
import type { CharacterDTO, ConfirmStatus, Role, WarTipo } from '@/lib/types';
import LoginView from './LoginView';
import CharacterWizard from './CharacterWizard';
import WarScreen from './WarScreen';

export interface CurrentData {
  user: { nome: string; role: Role; pontos: number };
  event: { id: string; tipo: WarTipo; dataIso: string; locked: boolean };
  myConfirmation: { status: ConfirmStatus; characterId: string | null } | null;
  characters: CharacterDTO[];
}

type State = { kind: 'loading' } | { kind: 'anon' } | { kind: 'ready'; data: CurrentData };

export default function GuerraApp() {
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [loginFailed, setLoginFailed] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api<CurrentData>('/api/war/current');
      setState({ kind: 'ready', data });
    } catch {
      setState({ kind: 'anon' });
    }
  }, []);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('erro') === 'login') {
      setLoginFailed(true);
      window.history.replaceState(null, '', '/');
    }
    void load();
  }, [load]);

  if (state.kind === 'loading') {
    return <div className="center-screen">Carregando…</div>;
  }
  if (state.kind === 'anon') return <LoginView loginFailed={loginFailed} />;
  if (state.data.characters.length === 0) {
    return <CharacterWizard onDone={load} />;
  }
  return <WarScreen data={state.data} reload={load} />;
}
