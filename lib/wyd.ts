import type { Classe, Especializacao, WarTipo } from './types';

export const CLASSES: Classe[] = ['TK', 'BM', 'HT', 'FM'];

export const SPECS_BY_CLASS: Record<Classe, Especializacao[]> = {
  TK: ['FISICO', 'MAGO'],
  BM: ['FISICO', 'MAGO'],
  HT: ['FISICO'],
  FM: ['CANCEL', 'BLOOD', 'MAGO'],
};

export const SPEC_LABELS: Record<Especializacao, string> = {
  FISICO: 'Físico',
  MAGO: 'Mago',
  CANCEL: 'Cancel',
  BLOOD: 'Blood',
};

export const TIPO_LABELS: Record<WarTipo, string> = {
  TORRE: 'Guerra de Torre',
  KEFRA: 'Kefra',
};

export function isValidCombo(classe: string, especializacao: string): boolean {
  const specs = SPECS_BY_CLASS[classe as Classe];
  return !!specs && specs.includes(especializacao as Especializacao);
}
