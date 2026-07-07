import { describe, expect, test } from 'vitest';
import { activeDayWars, warsOfDow } from '../lib/war-schedule';

const TIMES = { TORRE: '21:00', KEFRA: '20:00' };

// instante UTC de um horário de São Paulo (UTC-3)
function sp(dia: string, hora: string): Date {
  return new Date(`${dia}T${hora}:00-03:00`);
}
const tipos = (d: Date) => activeDayWars(d, TIMES).wars.map((w) => w.tipo);

// âncoras: 2026-07-06=segunda, 07=terça, 08=quarta, 11=sábado, 12=domingo, 13=segunda
describe('warsOfDow', () => {
  test('segunda→[Torre], terça→[Torre,Kefra], sáb/dom→[]', () => {
    expect(warsOfDow(1)).toEqual(['TORRE']);
    expect(warsOfDow(2)).toEqual(['TORRE', 'KEFRA']);
    expect(warsOfDow(6)).toEqual([]);
    expect(warsOfDow(0)).toEqual([]);
  });
});

describe('activeDayWars', () => {
  test('segunda → só Torre, no próprio dia', () => {
    const d = activeDayWars(sp('2026-07-06', '10:00'), TIMES);
    expect(d.dia).toBe('2026-07-06');
    expect(tipos(sp('2026-07-06', '10:00'))).toEqual(['TORRE']);
  });

  test('terça → Torre + Kefra no mesmo dia', () => {
    const d = activeDayWars(sp('2026-07-07', '10:00'), TIMES);
    expect(d.dia).toBe('2026-07-07');
    expect(d.wars.map((w) => w.tipo)).toEqual(['TORRE', 'KEFRA']);
    const kefra = d.wars.find((w) => w.tipo === 'KEFRA')!;
    expect(kefra.dataUtc.toISOString()).toBe(sp('2026-07-07', '20:00').toISOString());
  });

  test('fim = início + duração (Torre 35min, Kefra 20min por padrão)', () => {
    const d = activeDayWars(sp('2026-07-07', '10:00'), TIMES, { TORRE: 35, KEFRA: 20 });
    const torre = d.wars.find((w) => w.tipo === 'TORRE')!;
    const kefra = d.wars.find((w) => w.tipo === 'KEFRA')!;
    expect(torre.fimUtc.toISOString()).toBe(sp('2026-07-07', '21:35').toISOString());
    expect(kefra.fimUtc.toISOString()).toBe(sp('2026-07-07', '20:20').toISOString());
  });

  test('terça à noite (após horários) → ainda terça (só reseta na virada)', () => {
    expect(activeDayWars(sp('2026-07-07', '23:30'), TIMES).dia).toBe('2026-07-07');
  });

  test('quarta 00:10 → reset, só Torre de quarta', () => {
    const d = activeDayWars(sp('2026-07-08', '00:10'), TIMES);
    expect(d.dia).toBe('2026-07-08');
    expect(d.wars.map((w) => w.tipo)).toEqual(['TORRE']);
  });

  test('sábado → pula fim de semana, Torre de segunda', () => {
    const d = activeDayWars(sp('2026-07-11', '12:00'), TIMES);
    expect(d.dia).toBe('2026-07-13');
    expect(d.wars.map((w) => w.tipo)).toEqual(['TORRE']);
  });

  test('domingo → Torre de segunda', () => {
    expect(activeDayWars(sp('2026-07-12', '15:00'), TIMES).dia).toBe('2026-07-13');
  });
});
