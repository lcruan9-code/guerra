// Faixa da semana (segunda→domingo) no calendário de São Paulo (UTC-3 fixo).
const SP_OFFSET_MS = 3 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface WeekRange {
  inicio: string; // YYYY-MM-DD (segunda)
  fim: string; // YYYY-MM-DD (domingo)
}

function spDate(instantUtc: Date): { dia: string; dow: number } {
  const shifted = new Date(instantUtc.getTime() - SP_OFFSET_MS);
  return { dia: shifted.toISOString().slice(0, 10), dow: shifted.getUTCDay() };
}

export function currentWeekRange(nowUtc: Date): WeekRange {
  const { dow } = spDate(nowUtc);
  // getUTCDay: 0=dom..6=sáb. Queremos segunda como início.
  const daysSinceMonday = (dow + 6) % 7;
  const shifted = new Date(nowUtc.getTime() - SP_OFFSET_MS);
  const monday = new Date(shifted.getTime() - daysSinceMonday * DAY_MS);
  const sunday = new Date(monday.getTime() + 6 * DAY_MS);
  return {
    inicio: monday.toISOString().slice(0, 10),
    fim: sunday.toISOString().slice(0, 10),
  };
}
