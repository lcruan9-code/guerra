import type { WarTipo } from './types';

// Brasil não tem horário de verão desde 2019 → São Paulo é UTC-3 fixo.
const SP_OFFSET_MS = 3 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface WarTimes {
  TORRE: string; // "HH:MM"
  NOATUM: string;
}

export interface NextWar {
  tipo: WarTipo;
  dia: string; // YYYY-MM-DD no calendário de São Paulo
  dataUtc: Date;
}

function spCalendar(instantUtc: Date): { dia: string; dow: number } {
  const shifted = new Date(instantUtc.getTime() - SP_OFFSET_MS);
  return { dia: shifted.toISOString().slice(0, 10), dow: shifted.getUTCDay() };
}

function tipoDoDia(dow: number): WarTipo | null {
  if (dow >= 1 && dow <= 5) return 'TORRE'; // seg–sex
  if (dow === 0) return 'NOATUM'; // domingo
  return null; // sábado
}

export function warDateUtc(dia: string, time: string): Date {
  return new Date(`${dia}T${time}:00-03:00`);
}

// A guerra "ativa" é a do DIA ATUAL (se houver), válida o dia inteiro — mesmo
// depois do horário, para o líder registrar presença. Só vira na virada do dia
// (meia-noite em São Paulo). Se hoje não tem guerra (sábado), pega a próxima.
export function computeActiveWar(nowUtc: Date, times: WarTimes): NextWar {
  for (let i = 0; i < 8; i++) {
    const probe = new Date(nowUtc.getTime() + i * DAY_MS);
    const { dia, dow } = spCalendar(probe);
    const tipo = tipoDoDia(dow);
    if (tipo) return { tipo, dia, dataUtc: warDateUtc(dia, times[tipo]) };
  }
  throw new Error('Não foi possível determinar a guerra ativa.');
}
