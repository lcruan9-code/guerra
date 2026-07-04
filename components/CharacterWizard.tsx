'use client';

import Image from 'next/image';
import CharacterForm from './CharacterForm';

export default function CharacterWizard({ onDone }: { onDone: () => void }) {
  return (
    <div className="wizard">
      <Image className="wizard-logo" src="/guild-logo.png" alt="Guild" width={92} height={92} />
      <h1 className="wizard-title">Cadastre seu personagem</h1>
      <p className="wizard-sub">Rapidinho: nome, classe e especialização.</p>
      <CharacterForm onSaved={onDone} />
    </div>
  );
}
