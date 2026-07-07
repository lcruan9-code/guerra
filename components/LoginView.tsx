'use client';

import { useState } from 'react';
import Image from 'next/image';
import { api, ApiError } from '@/lib/api-client';
import { CLASSES, SPECS_BY_CLASS, SPEC_LABELS } from '@/lib/wyd';
import { BRAND, CLASSE_COLOR } from '@/lib/brand';
import type { Classe, Especializacao } from '@/lib/types';

// Login sem senha: só o nome do personagem. Se já existe, entra direto; se não,
// vira cadastro (classe + especialização) e cria a conta com esse nome.
export default function LoginView({ onDone }: { onDone: () => void }) {
  const [nome, setNome] = useState('');
  const [mode, setMode] = useState<'login' | 'create'>('login');
  const [classe, setClasse] = useState<Classe | null>(null);
  const [espec, setEspec] = useState<Especializacao | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const specs = classe ? SPECS_BY_CLASS[classe] : [];

  function pickClasse(c: Classe) {
    setClasse(c);
    setEspec(SPECS_BY_CLASS[c].length === 1 ? SPECS_BY_CLASS[c][0] : null);
  }

  async function entrar() {
    if (nome.trim().length < 2) return;
    setBusy(true);
    setError(null);
    try {
      await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ nome }) });
      onDone();
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) {
        setMode('create'); // personagem novo → cadastrar
      } else {
        setError(e instanceof ApiError ? e.message : 'Erro ao entrar.');
      }
    } finally {
      setBusy(false);
    }
  }

  async function criar() {
    if (!classe || !espec) return;
    setBusy(true);
    setError(null);
    try {
      await api('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ nome, classe, especializacao: espec }),
      });
      onDone();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Erro ao criar.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="wizard">
      <Image className="wizard-logo" src="/guild-logo.png" alt={BRAND.guildName} width={92} height={92} />

      {mode === 'login' ? (
        <>
          <h1 className="wizard-title">Entrar</h1>
          <p className="wizard-sub">Digite o nome do seu personagem. Sem senha — fica salvo neste aparelho.</p>
          <div className="form-card">
            <div>
              <label className="field-label">Nome do personagem</label>
              <input
                className="field-input"
                value={nome}
                autoFocus
                maxLength={30}
                placeholder="Ex.: Ursadas"
                onChange={(e) => setNome(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void entrar();
                }}
              />
            </div>
            {error && <p className="error-text" style={{ marginBottom: 0 }}>{error}</p>}
            <button className="btn-primary" disabled={busy || nome.trim().length < 2} onClick={entrar}>
              {busy ? 'Entrando…' : 'Entrar'}
            </button>
          </div>
        </>
      ) : (
        <>
          <h1 className="wizard-title">Novo personagem</h1>
          <p className="wizard-sub">
            <strong style={{ color: '#f0e6d2' }}>{nome}</strong> ainda não existe. Escolha a classe e a especialização
            para criar.
          </p>
          <div className="form-card">
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
              <button className="btn-cancel" onClick={() => { setMode('login'); setError(null); }}>
                Voltar
              </button>
              <button className="btn-primary" disabled={busy || !classe || !espec} onClick={criar}>
                {busy ? 'Criando…' : 'Criar e entrar'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
