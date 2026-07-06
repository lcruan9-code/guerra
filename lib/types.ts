export type Role = 'ADMIN' | 'MEMBRO';
export type Classe = 'TK' | 'BM' | 'HT' | 'FM';
export type Especializacao = 'FISICO' | 'MAGO' | 'CANCEL' | 'BLOOD';
export type WarTipo = 'TORRE' | 'KEFRA';
export type ConfirmStatus = 'VOU' | 'NAO_VOU' | 'TALVEZ';

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
