import type { AddTier, Equipment, Tipo } from './types';

// ── Tabelas de pontos ────────────────────────────────────────────
const ADD_PTS: Record<AddTier, number> = { SUX: 1, SEMI: 2, FULL: 3 };
const TIPO_PTS: Record<Tipo, number> = { T1: 1, T2: 2 };

const addPts = (a: AddTier | null | undefined): number => (a ? ADD_PTS[a] : 0);
const tipoPts = (t: Tipo | null | undefined): number => (t ? TIPO_PTS[t] : 0);

// Set / arma / escudo / cythera: só pontua a partir do +13.
function refinoSetPts(r: number | null | undefined): number {
  if (r == null) return 0;
  if (r >= 15) return 3;
  if (r === 14) return 2;
  if (r === 13) return 1;
  return 0;
}
// Capa: +11(+) = 2, +9/+10 = 1, senão 0.
function refinoCapaPts(r: number | null | undefined): number {
  if (r == null) return 0;
  if (r >= 11) return 2;
  if (r >= 9) return 1;
  return 0;
}
// Runa: +6..+9 = 2, +1..+5 = 1, não tem = 0.
function runaPts(r: number | null | undefined): number {
  if (r == null || r <= 0) return 0;
  return r >= 6 ? 2 : 1;
}
function petPts(lvl: number | null | undefined): number {
  if (lvl === 150) return 2;
  if (lvl === 120) return 1;
  return 0;
}

// ── Breakdown / total ────────────────────────────────────────────
export interface SlotScore {
  key: string;
  label: string;
  pontos: number;
}

export function slotBreakdown(eq: Equipment | null | undefined): SlotScore[] {
  const e = eq ?? {};
  const amu = e.amuletos ?? [];
  return [
    { key: 'pet', label: 'Cavalo/Pet', pontos: petPts(e.pet) },
    { key: 'cythera', label: 'Cythera', pontos: refinoSetPts(e.cythera?.refino) + addPts(e.cythera?.add) },
    { key: 'armadura', label: 'Armadura', pontos: refinoSetPts(e.armadura?.refino) },
    { key: 'calca', label: 'Calça', pontos: refinoSetPts(e.calca?.refino) },
    { key: 'luvas', label: 'Luvas', pontos: refinoSetPts(e.luvas?.refino) },
    { key: 'botas', label: 'Botas', pontos: refinoSetPts(e.botas?.refino) },
    { key: 'arma', label: 'Arma', pontos: refinoSetPts(e.arma?.refino) },
    { key: 'escudo', label: 'Escudo', pontos: refinoSetPts(e.escudo?.refino) },
    { key: 'capa', label: 'Capa', pontos: refinoCapaPts(e.capa?.refino) + addPts(e.capa?.add) },
    { key: 'runa', label: 'Runa', pontos: runaPts(e.runa?.refino) },
    { key: 'amuleto1', label: 'Amuleto 1', pontos: addPts(amu[0]) },
    { key: 'amuleto2', label: 'Amuleto 2', pontos: addPts(amu[1]) },
    { key: 'amuleto3', label: 'Amuleto 3', pontos: addPts(amu[2]) },
    { key: 'anel', label: 'Colar', pontos: tipoPts(e.anel) },
    { key: 'brinco', label: 'Brinco', pontos: tipoPts(e.brinco) },
    { key: 'cinto', label: 'Cinto', pontos: tipoPts(e.cinto) },
  ];
}

export function gearScore(eq: Equipment | null | undefined): number {
  return slotBreakdown(eq).reduce((sum, s) => sum + s.pontos, 0);
}

// GEAR_MAX derivado do set máximo (auto-valida em 48).
const MAX_EQUIP: Equipment = {
  pet: 150,
  cythera: { refino: 15, add: 'FULL' },
  armadura: { refino: 15 }, calca: { refino: 15 }, luvas: { refino: 15 }, botas: { refino: 15 },
  arma: { refino: 15 }, escudo: { refino: 15 },
  capa: { refino: 11, add: 'FULL' },
  runa: { refino: 9 },
  amuletos: ['FULL', 'FULL', 'FULL'],
  anel: 'T2', brinco: 'T2', cinto: 'T2',
};
export const GEAR_MAX = gearScore(MAX_EQUIP);

// ── Validação de payload (servidor) ──────────────────────────────
const ADDS: AddTier[] = ['SUX', 'SEMI', 'FULL'];
const TIPOS: Tipo[] = ['T1', 'T2'];

function vRefino(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 0 || v > 15) throw new Error('Refino inválido.');
  return v;
}
function vAdd(v: unknown): AddTier | null {
  if (v == null) return null;
  if (typeof v !== 'string' || !ADDS.includes(v as AddTier)) throw new Error('Add inválido.');
  return v as AddTier;
}
function vTipo(v: unknown): Tipo | null {
  if (v == null) return null;
  if (typeof v !== 'string' || !TIPOS.includes(v as Tipo)) throw new Error('Tipo inválido.');
  return v as Tipo;
}
function vPet(v: unknown): 120 | 150 | null {
  if (v == null) return null;
  if (v === 120 || v === 150) return v;
  throw new Error('Pet inválido.');
}

export function parseEquipment(input: unknown): Equipment {
  if (input == null || typeof input !== 'object') throw new Error('Equipamento inválido.');
  const e = input as Record<string, { refino?: unknown; add?: unknown } | unknown>;
  const dim = (o: unknown): { refino?: unknown; add?: unknown } =>
    o && typeof o === 'object' ? (o as { refino?: unknown; add?: unknown }) : {};
  const amuRaw = Array.isArray((e as { amuletos?: unknown }).amuletos)
    ? ((e as { amuletos?: unknown[] }).amuletos as unknown[])
    : [];
  if (amuRaw.length > 3) throw new Error('Máximo de 3 amuletos.');
  return {
    pet: vPet((e as { pet?: unknown }).pet),
    cythera: { refino: vRefino(dim(e.cythera).refino), add: vAdd(dim(e.cythera).add) },
    armadura: { refino: vRefino(dim(e.armadura).refino) },
    calca: { refino: vRefino(dim(e.calca).refino) },
    luvas: { refino: vRefino(dim(e.luvas).refino) },
    botas: { refino: vRefino(dim(e.botas).refino) },
    arma: { refino: vRefino(dim(e.arma).refino) },
    escudo: { refino: vRefino(dim(e.escudo).refino) },
    capa: { refino: vRefino(dim(e.capa).refino), add: vAdd(dim(e.capa).add) },
    runa: { refino: vRefino(dim(e.runa).refino) },
    amuletos: amuRaw.map(vAdd),
    anel: vTipo((e as { anel?: unknown }).anel),
    brinco: vTipo((e as { brinco?: unknown }).brinco),
    cinto: vTipo((e as { cinto?: unknown }).cinto),
  };
}
