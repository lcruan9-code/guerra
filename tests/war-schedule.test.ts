import { describe, expect, test } from 'vitest';
import { computeActiveWar } from '../lib/war-schedule';

const TIMES = { TORRE: '21:00', NOATUM: '21:00' };

// instante UTC de um horário de São Paulo (UTC-3)
function sp(dia: string, hora: string): Date {
  return new Date(`${dia}T${hora}:00-03:00`);
}

// datas-âncora: 2026-07-01=quarta, 03=sexta, 04=sábado, 05=domingo, 06=segunda
describe('computeActiveWar (guerra ativa do dia, vira na meia-noite SP)', () => {
  test('quarta de manhã → Torre da própria quarta às 21h', () => {
    const w = computeActiveWar(sp('2026-07-01', '10:00'), TIMES);
    expect(w.tipo).toBe('TORRE');
    expect(w.dia).toBe('2026-07-01');
    expect(w.dataUtc.toISOString()).toBe(sp('2026-07-01', '21:00').toISOString());
  });

  test('quarta às 22h (após o horário) → ainda a Torre de quarta (só reseta na virada)', () => {
    const w = computeActiveWar(sp('2026-07-01', '22:00'), TIMES);
    expect(w.tipo).toBe('TORRE');
    expect(w.dia).toBe('2026-07-01');
  });

  test('quinta 00:10 (virou o dia) → Torre de quinta, reset', () => {
    const w = computeActiveWar(sp('2026-07-02', '00:10'), TIMES);
    expect(w.tipo).toBe('TORRE');
    expect(w.dia).toBe('2026-07-02');
  });

  test('guerra de madrugada: quinta 06:00, guerra foi às 05h → ainda é a de quinta', () => {
    const w = computeActiveWar(sp('2026-07-02', '06:00'), { TORRE: '05:00', NOATUM: '21:00' });
    expect(w.dia).toBe('2026-07-02');
    expect(w.dataUtc.toISOString()).toBe(sp('2026-07-02', '05:00').toISOString());
  });

  test('sábado (sem guerra) → Noatum de domingo', () => {
    const w = computeActiveWar(sp('2026-07-04', '12:00'), TIMES);
    expect(w.tipo).toBe('NOATUM');
    expect(w.dia).toBe('2026-07-05');
  });

  test('domingo às 23h (após o horário) → ainda Noatum de domingo', () => {
    const w = computeActiveWar(sp('2026-07-05', '23:00'), TIMES);
    expect(w.tipo).toBe('NOATUM');
    expect(w.dia).toBe('2026-07-05');
  });

  test('segunda 00:10 → Torre de segunda, reset', () => {
    const w = computeActiveWar(sp('2026-07-06', '00:10'), TIMES);
    expect(w.tipo).toBe('TORRE');
    expect(w.dia).toBe('2026-07-06');
  });
});
