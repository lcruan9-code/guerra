export interface ComboRow {
  classe: string;
  especializacao: string;
}

export interface Summary {
  counts: Record<string, number>;
  TOTAL_FISICO: number;
  TOTAL_MAGO: number;
  alerts: string[];
}

const MIN_FM_BLOOD = 2;
const MIN_TK = 3;
const IMBALANCE_RATIO = 0.65;

export function computeSummary(rows: ComboRow[]): Summary {
  const counts: Record<string, number> = {};
  let fisico = 0;
  let mago = 0;
  let tk = 0;

  for (const r of rows) {
    const key = `${r.classe}_${r.especializacao}`;
    counts[key] = (counts[key] ?? 0) + 1;
    if (r.especializacao === 'FISICO') fisico++;
    if (r.especializacao === 'MAGO') mago++;
    if (r.classe === 'TK') tk++;
  }

  const alerts: string[] = [];
  if (rows.length > 0) {
    if ((counts['FM_BLOOD'] ?? 0) < MIN_FM_BLOOD) alerts.push('Falta de cura (poucos FM Blood)');
    if (tk < MIN_TK) alerts.push('Linha de frente fraca (poucos TK)');
    const base = fisico + mago;
    if (base > 0) {
      if (fisico / base > IMBALANCE_RATIO) alerts.push('Composição desbalanceada (excesso de físicos)');
      if (mago / base > IMBALANCE_RATIO) alerts.push('Composição desbalanceada (excesso de magos)');
    }
  }

  return { counts, TOTAL_FISICO: fisico, TOTAL_MAGO: mago, alerts };
}
