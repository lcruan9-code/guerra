'use client';

import { useState } from 'react';
import { api, ApiError } from '@/lib/api-client';

export default function LeaderUnlockCard({ onDone }: { onDone: () => void | Promise<void> }) {
  const [senha, setSenha] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!senha) return;
    setBusy(true);
    setError(null);
    try {
      await api('/api/leader/unlock', { method: 'POST', body: JSON.stringify({ senha }) });
      await onDone();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Erro ao entrar.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="form-card">
      <div>
        <div className="login-card-title" style={{ marginBottom: 14 }}>🔒 Área do líder</div>
        <label className="field-label">Senha do líder</label>
        <input
          className="field-input"
          type="password"
          value={senha}
          autoFocus
          onChange={(e) => setSenha(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void submit();
          }}
          placeholder="Digite a senha"
        />
      </div>
      {error && <p className="error-text" style={{ marginBottom: 0 }}>{error}</p>}
      <button className="btn-primary" disabled={busy || !senha} onClick={submit}>
        {busy ? 'Verificando…' : 'Entrar'}
      </button>
    </div>
  );
}
