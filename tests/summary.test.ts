import { describe, expect, test } from 'vitest';
import { computeSummary } from '../lib/summary';

function rows(spec: Record<string, number>) {
  const out: { classe: string; especializacao: string }[] = [];
  for (const [key, n] of Object.entries(spec)) {
    const [classe, especializacao] = key.split('_');
    for (let i = 0; i < n; i++) out.push({ classe, especializacao });
  }
  return out;
}

describe('computeSummary', () => {
  test('vazio: contagens zeradas e sem alertas', () => {
    const s = computeSummary([]);
    expect(s.counts).toEqual({});
    expect(s.TOTAL_FISICO).toBe(0);
    expect(s.TOTAL_MAGO).toBe(0);
    expect(s.alerts).toEqual([]);
  });

  test('cenário do escopo: contagens e totais corretos', () => {
    const s = computeSummary(rows({ BM_FISICO: 5, BM_MAGO: 2, TK_FISICO: 3, FM_BLOOD: 2, FM_CANCEL: 1, FM_MAGO: 6, HT_FISICO: 2 }));
    expect(s.counts.BM_FISICO).toBe(5);
    expect(s.counts.FM_BLOOD).toBe(2);
    expect(s.TOTAL_FISICO).toBe(10); // 5 BM + 3 TK + 2 HT
    expect(s.TOTAL_MAGO).toBe(8); // 2 BM + 6 FM
    // FM_BLOOD=2 (ok), TK=3 (ok), 10/18=0.55 (ok) → sem alertas
    expect(s.alerts).toEqual([]);
  });

  test('alerta de cura quando FM_BLOOD < 2', () => {
    const s = computeSummary(rows({ TK_FISICO: 3, FM_BLOOD: 1, BM_MAGO: 2 }));
    expect(s.alerts).toContain('Falta de cura (poucos FM Blood)');
  });

  test('alerta de linha de frente quando TK < 3', () => {
    const s = computeSummary(rows({ TK_FISICO: 2, FM_BLOOD: 2, BM_MAGO: 2 }));
    expect(s.alerts).toContain('Linha de frente fraca (poucos TK)');
  });

  test('alerta de excesso de físicos quando > 65%', () => {
    const s = computeSummary(rows({ TK_FISICO: 5, BM_FISICO: 4, BM_MAGO: 1, FM_BLOOD: 2 }));
    expect(s.alerts).toContain('Composição desbalanceada (excesso de físicos)');
  });

  test('alerta de excesso de magos quando > 65%', () => {
    const s = computeSummary(rows({ TK_MAGO: 3, BM_MAGO: 4, TK_FISICO: 3, FM_BLOOD: 2 }));
    // magos 7 / (7+3) = 0.7 → alerta; TK total = 6 → sem alerta de frente
    expect(s.alerts).toContain('Composição desbalanceada (excesso de magos)');
    expect(s.alerts).not.toContain('Linha de frente fraca (poucos TK)');
  });
});
