'use client';

import { useEffect, useState } from 'react';

function fmt(msLeft: number): string {
  if (msLeft <= 0) return 'EM ANDAMENTO';
  const s = Math.floor(msLeft / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h >= 24) {
    const d = Math.floor(h / 24);
    return `${d}d ${h % 24}h`;
  }
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export default function Countdown({ targetIso, ended }: { targetIso: string; ended?: boolean }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (ended) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [ended]);

  if (ended) return <span className="countdown">ENCERRADA</span>;
  const left = new Date(targetIso).getTime() - now;
  return <span className={`countdown${left <= 0 ? ' live' : ''}`}>{fmt(left)}</span>;
}
