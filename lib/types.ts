export type Role = 'ADMIN' | 'MEMBRO';
export type Classe = 'TK' | 'BM' | 'HT' | 'FM';
export type Especializacao = 'FISICO' | 'MAGO' | 'CANCEL' | 'BLOOD';
export type WarTipo = 'TORRE' | 'KEFRA';
export type ConfirmStatus = 'VOU' | 'NAO_VOU' | 'TALVEZ';
export type AddTier = 'SUX' | 'SEMI' | 'FULL';
export type Tipo = 'T1' | 'T2';

export interface Equipment {
  pet?: 120 | 150 | null;
  cythera?: { refino?: number | null; add?: AddTier | null };
  armadura?: { refino?: number | null };
  calca?: { refino?: number | null };
  luvas?: { refino?: number | null };
  botas?: { refino?: number | null };
  arma?: { refino?: number | null };
  escudo?: { refino?: number | null };
  capa?: { refino?: number | null; add?: AddTier | null };
  runa?: { refino?: number | null };
  amuletos?: (AddTier | null)[];
  anel?: Tipo | null;
  brinco?: Tipo | null;
  cinto?: Tipo | null;
}

export interface SessionUser {
  id: string;
  nome: string;
  role: Role;
}

export interface CharacterDTO {
  id: string;
  nome: string;
  classe: Classe;
  especializacao: Especializacao;
  principal: boolean;
  equipment?: Equipment | null;
  score?: number;
}

export interface ListEntry {
  userId: string;
  nome: string;
  personagem: string | null;
  classe: Classe | null;
  especializacao: Especializacao | null;
  participou: boolean | null;
}

export interface WarListsDTO {
  vou: ListEntry[];
  talvez: ListEntry[];
  nao_vou: ListEntry[];
}
