export type Role = 'ADMIN' | 'MEMBRO';
export type Classe = 'TK' | 'BM' | 'HT' | 'FM';
export type Especializacao = 'FISICO' | 'MAGO' | 'CANCEL' | 'BLOOD';
export type WarTipo = 'TORRE' | 'KEFRA';
export type ConfirmStatus = 'VOU' | 'NAO_VOU' | 'TALVEZ';
export type AddTier = 'SUX' | 'SEMI' | 'FULL';
export type Tipo = 'T1' | 'T2';

export type Reino = 'RED' | 'BLUE';
export type Servidor = 'INFINITY' | 'ROGUE';
export type LicensePlan = 'MENSAL' | 'TRIMESTRAL' | 'SEMESTRAL' | 'VITALICIO';
export type LicenseStatus = 'DISPONIVEL' | 'ATIVA' | 'EXPIRADA' | 'REVOGADA';
export type AccountStatus = 'DISPONIVEL' | 'EM_USO';
export type Tier = 1 | 2 | 3;

export interface GuildDTO {
  id: string;
  slug: string;
  nome: string;
  reino: Reino;
  servidor: Servidor;
  logo_url: string | null;
  cor_tema: string | null;
  ativa: boolean;
  valida_ate?: string | null;
  created_at: string;
}

export interface LicenseDTO {
  id: string;
  key: string;
  guild_id: string | null;
  guild_nome?: string | null;
  guild_slug?: string | null;
  plano: LicensePlan;
  status: LicenseStatus;
  valida_ate: string | null;
  created_at: string;
}

export interface AccountDTO {
  id: string;
  guild_id: string;
  personagem: string;
  login: string;
  classe: string;
  especializacao: string;
  servidor: string;
  tier: number;
  ativo: boolean;
  status: AccountStatus;
  can_view: boolean;
  senha?: string | null;
  senha_interna?: string | null;
}

export interface PublicAccountDTO {
  id: string;
  personagem: string;
  classe: string;
  especializacao: string;
  servidor: string;
  tier: number;
  status: AccountStatus;
  taken_by: string | null;
}

export interface HeldAccountDTO {
  id: string;
  personagem: string;
  login: string;
  senha: string;
  senha_interna: string;
  classe: string;
  especializacao: string;
  servidor: string;
}

export interface ColetaDTO {
  id: string;
  guild_id: string;
  conta_login: string;
  classe: string;
  especializacao: string;
  nome_pessoa: string;
  servidor_origem: string;
  data_hora: string;
  data_entrega: string | null;
  ativo: boolean;
}

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
  guild_id?: string;
  nome: string;
  role: Role;
}

export interface CharacterDTO {
  id: string;
  guild_id?: string;
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
