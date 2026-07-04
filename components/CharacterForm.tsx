'use client';

import { useState } from 'react';
import { api, ApiError } from '@/lib/api-client';
import { CLASSES, SPECS_BY_CLASS, SPEC_LABELS } from '@/lib/wyd';
import type { CharacterDTO, Classe, Especializacao } from '@/lib/types';

interface Props {
  initial?: CharacterDTO;
  onSaved: () => void;
  onCancel?: () => void;
}

export default function CharacterForm({ initial, onSaved, onCancel }: Props) {
  const [nome, setNome] = useState(initial?.nome ?? '');
  const [classe, setClasse] = useState<Classe | null>(initial?.classe ?? null);
  const [espec, setEspec] = useState<Especializacao | null>(initial?.especializacao ?? null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const specs = classe ? SPECS_BY_CLASS[classe] : [];

  function pickClasse(c: Classe) {
    setClasse(c);
    // HT só tem Físico: já seleciona; senão limpa para forçar escolha válida.
    setEspec(SPECS_BY_CLASS[c].length === 1 ? SPECS_BY_CLASS[c][0] : null);
  }

  async function save() {
    if (!classe || !espec) return;
    setSaving(true);
    setError(null);
    try {
      if (initial) {
        await api(`/api/characters/${initial.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ nome, classe, especializacao: espec }),
        });
      } else {
        await api('/api/characters', {
          method: 'POST',
          body: JSON.stringify({ nome, classe, especializacao: espec }),
        });
      }
      onSaved();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Erro ao salvar.');
    } finally {
      setSaving(false);
    }
  }

  const canSave = nome.trim().length >= 2 && !!classe && !!espec && !saving;

  return (
    <div className="flex flex-col gap-4">
      <input
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        placeholder="Nome do personagem"
        maxLength={30}
        className="rounded-xl bg-slate-800 px-4 py-3 text-lg outline-none focus:ring-2 focus:ring-amber-400"
      />
      <div>
        <p className="mb-2 text-sm text-slate-400">Classe</p>
        <div className="grid grid-cols-4 gap-2">
          {CLASSES.map((c) => (
            <button
              key={c}
              onClick={() => pickClasse(c)}
              className={`rounded-xl py-3 text-lg font-bold ${classe === c ? 'bg-amber-400 text-slate-900' : 'bg-slate-800'}`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>
      {classe && specs.length > 1 && (
        <div>
          <p className="mb-2 text-sm text-slate-400">Especialização</p>
          <div className="grid grid-cols-3 gap-2">
            {specs.map((s) => (
              <button
                key={s}
                onClick={() => setEspec(s)}
                className={`rounded-xl py-3 font-semibold ${espec === s ? 'bg-amber-400 text-slate-900' : 'bg-slate-800'}`}
              >
                {SPEC_LABELS[s]}
              </button>
            ))}
          </div>
        </div>
      )}
      {error && <p className="text-sm text-red-400">{error}</p>}
      <div className="flex gap-2">
        {onCancel && (
          <button onClick={onCancel} className="flex-1 rounded-xl bg-slate-800 py-3">
            Cancelar
          </button>
        )}
        <button
          onClick={save}
          disabled={!canSave}
          className="flex-1 rounded-xl bg-emerald-500 py-3 text-lg font-bold text-slate-950 disabled:opacity-40"
        >
          {saving ? 'Salvando…' : 'Salvar'}
        </button>
      </div>
    </div>
  );
}
