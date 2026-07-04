'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api-client';
import { UNIT, type RankingViewDTO } from '@/lib/admin-types';

function fmtDate(d: string): string {
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y.slice(2)}`;
}

export default function RankingSheet({ onClose }: { onClose: () => void }) {
  const [data, setData] = useState<RankingViewDTO | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<RankingViewDTO>('/api/rankings')
      .then(setData)
      .catch(() => setError('Não foi possível carregar o ranking.'));
  }, []);

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <h2 className="sheet-title">🏆 Premiações da semana</h2>

        {error && <p className="error-text">{error}</p>}
        {!data && !error && <p className="empty-hint">Carregando…</p>}

        {data && (
          <>
            <p className="rank-week">
              {fmtDate(data.week.inicio)} — {fmtDate(data.week.fim)}
            </p>

            {data.week.texto && <div className="rank-prize-banner">🎁 {data.week.texto}</div>}

            <div className="rank-me">
              <div className="big">{data.me.pontos} pts</div>
              <div className="lbl">
                {data.me.posicao ? `Você está em ${data.me.posicao}º de ${data.me.total}` : 'Sem pontos ainda'}
              </div>
            </div>

            {data.awards.length === 0 && (
              <p className="empty-hint" style={{ marginTop: 18 }}>
                Nenhum prêmio ativo no momento. O líder define as premiações da semana.
              </p>
            )}

            {data.awards.map((a) => (
              <div key={a.key} className="rank-award" style={{ marginTop: 18 }}>
                <div className="rank-award-head">
                  <span className="rank-award-title">{a.label}</span>
                  {a.premio && <span className="rank-award-prize">🎁 {a.premio}</span>}
                </div>
                {a.top.length === 0 ? (
                  <p className="empty-hint">Sem pontuação ainda.</p>
                ) : (
                  a.top.map((r, i) => (
                    <div key={r.userId} className="rank-line">
                      <span className={`rank-pos${i === 0 ? ' top1' : ''}`}>{i + 1}º</span>
                      <span className="nome">{r.nome}</span>
                      <span className="val">
                        {r.valor} {UNIT[a.key]}
                      </span>
                    </div>
                  ))
                )}
              </div>
            ))}

            <button onClick={onClose} className="btn-ghost full" style={{ marginTop: 18 }}>
              Fechar
            </button>
          </>
        )}
      </div>
    </div>
  );
}
