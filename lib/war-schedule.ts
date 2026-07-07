import type { WarTipo } from './types';

// Brasil não tem horário de verão desde 2019 → São Paulo é UTC-3 fixo.
const SP_OFFSET_MS = 3 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface WarTimes {
  TORRE: string; // "HH:MM" — horário de início
  KEFRA: string;
}

export interface WarDurations {
  TORRE: number; // minutos até o fim
  KEFRA: number;
}

// Torre é fixa (21:00→21:35). Kefra é mob: 20min é só o teto antes do fim automático.
export const DEFAULT_DURATIONS: WarDurations = { TORRE: 35, KEFRA: 20 };

export interface DayWar {
  tipo: WarTipo;
  dia: string; // YYYY-MM-DD no calendário de São Paulo
  dataUtc: Date; // início
  fimUtc: Date; // fim programado (início + duração)
}

export interface ActiveDay {
  dia: string;
  wars: DayWar[];
}

function spCalendar(instantUtc: Date): { dia: string; dow: number } {
  const shifted = new Date(instantUtc.getTime() - SP_OFFSET_MS);
  return { dia: shifted.toISOString().slice(0, 10), dow: shifted.getUTCDay() };
}

// Guerras de um dia da semana (dow: 0=dom..6=sáb).
// Torre: seg–sex. Kefra: terça (dow=2), junto da Torre. Sábado/domingo: nada.
export function warsOfDow(dow: number): WarTipo[] {
  if (dow < 1 || dow > 5) return [];
  return dow === 2 ? ['TORRE', 'KEFRA'] : ['TORRE'];
}

export function warDateUtc(dia: string, time: string): Date {
  return new Date(`${dia}T${time}:00-03:00`);
}

export function warEndUtc(startUtc: Date, durMin: number): Date {
  return new Date(startUtc.getTime() + durMin * 60 * 1000);
}

// Dia ativo = hoje (se tiver guerra), válido o dia inteiro; senão o próximo dia
// com guerra. Retorna todas as guerras do dia (na terça, Torre + Kefra).
export function activeDayWars(
  nowUtc: Date,
  times: WarTimes,
  durs: WarDurations = DEFAULT_DURATIONS,
): ActiveDay {
  for (let i = 0; i < 8; i++) {
    const probe = new Date(nowUtc.getTime() + i * DAY_MS);
    const { dia, dow } = spCalendar(probe);
    const tipos = warsOfDow(dow);
    if (tipos.length) {
      return {
        dia,
        wars: tipos.map((tipo) => {
          const dataUtc = warDateUtc(dia, times[tipo]);
          return { tipo, dia, dataUtc, fimUtc: warEndUtc(dataUtc, durs[tipo]) };
        }),
      };
    }
  }
  throw new Error('Não foi possível determinar a guerra ativa.');
}
