import { describe, expect, test } from 'vitest';
import { computeNextWar } from '../lib/war-schedule';

const TIMES = { TORRE: '21:00', NOATUM: '21:00' };

// helper: instante UTC de um horário de São Paulo (UTC-3)
function sp(dia: string, hora: string): Date {
  return new Date(`${dia}T${hora}:00-03:00`);
}

describe('computeNextWar', () => {
  test('quarta de manhã → Torre no mesmo dia às 21h SP', () => {
    const w = computeNextWar(sp('2026-07-01', '10:00'), TIMES);
    expect(w.tipo).toBe('TORRE');
    expect(w.dia).toBe('2026-07-01');
    expect(w.dataUtc.toISOString()).toBe(sp('2026-07-01', '21:00').toISOString());
  });

  test('quarta às 22h (guerra já passou) → Torre de quinta', () => {
    const w = computeNextWar(sp('2026-07-01', '22:00'), TIMES);
    expect(w.tipo).toBe('TORRE');
    expect(w.dia).toBe('2026-07-02');
  });

  test('sexta às 22h → pula sábado, Noatum de domingo', () => {
    const w = computeNextWar(sp('2026-07-03', '22:00'), TIMES);
    expect(w.tipo).toBe('NOATUM');
    expect(w.dia).toBe('2026-07-05');
  });

  test('sábado qualquer hora → Noatum de domingo', () => {
    const w = computeNextWar(sp('2026-07-04', '12:00'), TIMES);
    expect(w.tipo).toBe('NOATUM');
    expect(w.dia).toBe('2026-07-05');
  });

  test('domingo antes das 21h → Noatum do próprio domingo', () => {
    const w = computeNextWar(sp('2026-07-05', '20:00'), TIMES);
    expect(w.tipo).toBe('NOATUM');
    expect(w.dia).toBe('2026-07-05');
  });

  test('domingo às 22h → Torre de segunda', () => {
    const w = computeNextWar(sp('2026-07-05', '22:00'), TIMES);
    expect(w.tipo).toBe('TORRE');
    expect(w.dia).toBe('2026-07-06');
  });

  test('respeita horário customizado', () => {
    const w = computeNextWar(sp('2026-07-01', '19:30'), { TORRE: '19:00', NOATUM: '21:00' });
    // Torre de hoje era 19:00, já passou → quinta
    expect(w.dia).toBe('2026-07-02');
  });

  test('exatamente no horário da guerra conta como passada', () => {
    const w = computeNextWar(sp('2026-07-01', '21:00'), TIMES);
    expect(w.dia).toBe('2026-07-02');
  });
});
