'use client';

import CharacterForm from './CharacterForm';

export default function CharacterWizard({ onDone }: { onDone: () => void }) {
  return (
    <main className="mx-auto min-h-dvh max-w-md p-6">
      <h1 className="text-2xl font-bold">Cadastre seu personagem</h1>
      <p className="mb-6 mt-1 text-slate-400">Rapidinho: nome, classe e especialização.</p>
      <CharacterForm onSaved={onDone} />
    </main>
  );
}
