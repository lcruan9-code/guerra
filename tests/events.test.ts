import { describe, expect, test } from 'vitest';
import { isEventEnded, type EventRow } from '../lib/events';

const base: EventRow = { id: 'e1', tipo: 'TORRE', data: new Date('2026-07-07T00:00:00-03:00') };
const now = new Date('2026-07-07T21:20:00-03:00');

describe('isEventEnded', () => {
  test('antes do fim programado → não encerrada', () => {
    const ev = { ...base, fim: new Date('2026-07-07T21:35:00-03:00') };
    expect(isEventEnded(ev, now)).toBe(false);
  });

  test('depois do fim programado → encerrada', () => {
    const ev = { ...base, fim: new Date('2026-07-07T21:00:00-03:00') };
    expect(isEventEnded(ev, now)).toBe(true);
  });

  test('finalização manual (Kefra morto) encerra mesmo antes do fim', () => {
    const ev = { ...base, tipo: 'KEFRA' as const, fim: new Date('2026-07-07T23:00:00-03:00'), encerrado_em: now };
    expect(isEventEnded(ev, now)).toBe(true);
  });

  test('sem fim e sem finalização → não encerrada', () => {
    expect(isEventEnded(base, now)).toBe(false);
  });
});
