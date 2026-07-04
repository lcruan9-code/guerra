import type { Classe } from './types';

export const BRAND = {
  guildName: process.env.NEXT_PUBLIC_GUILD_NAME || 'IMPERIUM',
  reino: process.env.NEXT_PUBLIC_REINO || 'RED',
};

// Cores por classe — mesma paleta do ecossistema da guild.
export const CLASSE_COLOR: Record<Classe, string> = {
  TK: '#e0a35a',
  BM: '#7d97e8',
  HT: '#5fc3a0',
  FM: '#d97aa0',
};

export function classeEdge(classe: Classe | null | undefined): string {
  return classe ? CLASSE_COLOR[classe] : 'rgba(212,178,90,.3)';
}
