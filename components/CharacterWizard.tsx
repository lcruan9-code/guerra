'use client';

import Image from 'next/image';
import { BRAND } from '@/lib/brand';
import CharacterForm from './CharacterForm';

// `register`: primeiro acesso, sem sessão — cria a conta junto com o personagem.
export default function CharacterWizard({ onDone, register }: { onDone: () => void; register?: boolean }) {
  return (
    <div className="wizard">
      <Image className="wizard-logo" src="/guild-logo.png" alt={BRAND.guildName} width={92} height={92} />
      <h1 className="wizard-title">{register ? 'Entre com seu personagem' : 'Cadastre seu personagem'}</h1>
      <p className="wizard-sub">
        {register
          ? 'Sem senha nem e-mail: informe nome, classe e especialização. Fica salvo neste aparelho.'
          : 'Rapidinho: nome, classe e especialização.'}
      </p>
      <CharacterForm onSaved={onDone} register={register} />
    </div>
  );
}
