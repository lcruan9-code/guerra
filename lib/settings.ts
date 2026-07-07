import { query } from './db';
import type { WarDurations, WarTimes } from './war-schedule';
import { DEFAULT_DURATIONS } from './war-schedule';

const DEFAULT_TIME = '21:00';

export async function getWarTimes(): Promise<WarTimes> {
  const rows = await query<{ key: string; value: string }>(
    "SELECT key, value FROM settings WHERE key IN ('war_time_torre','war_time_kefra')",
  );
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return {
    TORRE: map['war_time_torre'] ?? DEFAULT_TIME,
    KEFRA: map['war_time_kefra'] ?? DEFAULT_TIME,
  };
}

// Duração (min) de cada guerra. Torre: fixa (fim = início + duração). Kefra: é o
// tempo máximo antes do fim automático — o líder pode encerrar antes ("Kefra morto").
export async function getWarDurations(): Promise<WarDurations> {
  const rows = await query<{ key: string; value: string }>(
    "SELECT key, value FROM settings WHERE key IN ('war_dur_torre','war_dur_kefra')",
  );
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  const toMin = (v: string | undefined, def: number) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? Math.round(n) : def;
  };
  return {
    TORRE: toMin(map['war_dur_torre'], DEFAULT_DURATIONS.TORRE),
    KEFRA: toMin(map['war_dur_kefra'], DEFAULT_DURATIONS.KEFRA),
  };
}
