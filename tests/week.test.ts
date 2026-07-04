import { describe, expect, test } from 'vitest';
import { currentWeekRange } from '../lib/week';

// instante UTC de um horário de São Paulo (UTC-3)
function sp(dia: string, hora: string): Date {
  return new Date(`${dia}T${hora}:00-03:00`);
}

describe('currentWeekRange (segunda a domingo, fuso SP)', () => {
  test('quarta-feira → semana de seg 29/06 a dom 05/07', () => {
    const w = currentWeekRange(sp('2026-07-01', '10:00'));
    expect(w.inicio).toBe('2026-06-29');
    expect(w.fim).toBe('2026-07-05');
  });

  test('segunda de madrugada → início na própria segunda', () => {
    const w = currentWeekRange(sp('2026-06-29', '00:30'));
    expect(w.inicio).toBe('2026-06-29');
    expect(w.fim).toBe('2026-07-05');
  });

  test('domingo à noite → ainda na mesma semana', () => {
    const w = currentWeekRange(sp('2026-07-05', '23:00'));
    expect(w.inicio).toBe('2026-06-29');
    expect(w.fim).toBe('2026-07-05');
  });

  test('vira a semana na segunda seguinte', () => {
    const w = currentWeekRange(sp('2026-07-06', '00:10'));
    expect(w.inicio).toBe('2026-07-06');
    expect(w.fim).toBe('2026-07-12');
  });
});
