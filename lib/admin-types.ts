// Tipos compartilhados entre as rotas admin/rankings e os componentes de UI.
export type AwardKey = 'PONTOS' | 'KS_TORRE' | 'KEFRA' | 'PARTICIPACAO';

export interface AwardDTO {
  key: AwardKey;
  label: string;
  ativo: boolean;
  premio: string;
  ordem: number;
}

export interface RankEntryDTO {
  userId: string;
  nome: string;
  valor: number;
}

export interface RosterEntryDTO {
  userId: string;
  nome: string;
  status: 'VOU' | 'NAO_VOU' | 'TALVEZ';
  personagem: string | null;
  classe: string | null;
  participou: boolean | null;
  ks: number;
  kefra: number;
}

export interface AdminOverviewDTO {
  warTimes: { TORRE: string; KEFRA: string };
  warDurations: { TORRE: number; KEFRA: number };
  torreTerca: string;
  week: { inicio: string; fim: string; texto: string };
  awards: AwardDTO[];
  nextEvent: { id: string; tipo: string; dataIso: string; cancelado: boolean };
  roster: RosterEntryDTO[];
  players: Array<{ userId: string; nome: string; role: string; pontos: number; presencas: number }>;
}

export interface RosterViewDTO {
  ksLabel: 'KS' | 'Kefra';
  ksCap: number;
  ksTotal: number;
  roster: RosterEntryDTO[];
}

export interface DayWarDTO {
  id: string;
  tipo: string;
  ksLabel: 'KS' | 'Kefra';
  ksCap: number;
  ksTotal: number;
}
export interface DayRowDTO {
  userId: string;
  nome: string;
  personagem: string | null;
  classe: string | null;
  cells: Record<string, { participou: boolean | null; ks: number }>;
}
export interface DayViewDTO {
  dia: string;
  wars: DayWarDTO[];
  rows: DayRowDTO[];
}

export interface EventListItemDTO {
  id: string;
  tipo: string;
  dia: string;
  dataIso: string;
  cancelado: boolean;
  vou: number;
  participou: number;
}

export interface RankingViewDTO {
  week: { inicio: string; fim: string; texto: string };
  awards: Array<AwardDTO & { top: RankEntryDTO[] }>;
  me: { pontos: number; posicao: number | null; total: number };
}

export const UNIT: Record<AwardKey, string> = {
  PONTOS: 'pts',
  KS_TORRE: 'KS',
  KEFRA: 'kefra',
  PARTICIPACAO: 'guerras',
};
