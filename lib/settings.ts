import { query } from './db';
import type { WarTimes } from './war-schedule';

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
