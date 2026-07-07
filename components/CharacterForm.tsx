'use client';

import { useState } from 'react';
import { api, ApiError } from '@/lib/api-client';
import { CLASSES, SPECS_BY_CLASS, SPEC_LABELS } from '@/lib/wyd';
import { CLASSE_COLOR } from '@/lib/brand';
import type { CharacterDTO, Classe, Especializacao } from '@/lib/types';

interface Props {
  initial?: CharacterDTO;
  onSaved: () => void;
  onCancel?: () => void;
  /** 1º cadastro (sem sessão ainda): cria o usuário + personagem e abre a sessão. */
  register?: boolean;
}

export default function CharacterForm({ initial, onSaved, onCancel, register }: Props) {
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
        await api(register ? '/api/auth/register' : '/api/characters', {
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
    <div className="form-card">
      <div>
        <label className="field-label">Nome do personagem</label>
        <input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Ex.: Kaorin"
          maxLength={30}
          className="field-input"
        />
      </div>

      <div>
        <label className="field-label">Classe</label>
        <div className="pick-grid c4">
          {CLASSES.map((c) => (
            <button
              key={c}
              onClick={() => pickClasse(c)}
              className={`pick-btn cls${classe === c ? ' on' : ''}`}
              style={
                classe === c
                  ? ({ '--clsbg': CLASSE_COLOR[c], '--clsedge': CLASSE_COLOR[c] } as React.CSSProperties)
                  : undefined
              }
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {classe && specs.length > 1 && (
        <div>
          <label className="field-label">Especialização</label>
          <div className="pick-grid c3">
            {specs.map((s) => (
              <button key={s} onClick={() => setEspec(s)} className={`pick-btn${espec === s ? ' on' : ''}`}>
                {SPEC_LABELS[s]}
              </button>
            ))}
          </div>
        </div>
      )}

      {error && <p className="error-text" style={{ marginBottom: 0 }}>{error}</p>}

      <div className="form-actions">
        {onCancel && (
          <button onClick={onCancel} className="btn-cancel">
            Cancelar
          </button>
        )}
        <button onClick={save} disabled={!canSave} className="btn-primary">
          {saving ? 'Salvando…' : 'Salvar'}
        </button>
      </div>
    </div>
  );
}
