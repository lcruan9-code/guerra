import { describe, expect, test } from 'vitest';
import { gearScore, slotBreakdown, parseEquipment, GEAR_MAX } from '../lib/gear';
import type { Equipment } from '../lib/types';

const MAX: Equipment = {
  pet: 150,
  cythera: { refino: 15, add: 'FULL' },
  armadura: { refino: 15 }, calca: { refino: 15 }, luvas: { refino: 15 }, botas: { refino: 15 },
  arma: { refino: 15 }, escudo: { refino: 15 },
  capa: { refino: 11, add: 'FULL' },
  runa: { refino: 9 },
  amuletos: ['FULL', 'FULL', 'FULL'],
  anel: 'T2', brinco: 'T2', cinto: 'T2',
};

describe('gear score', () => {
  test('set vazio ou null = 0', () => {
    expect(gearScore(null)).toBe(0);
    expect(gearScore({})).toBe(0);
  });

  test('set máximo = 48 e GEAR_MAX = 48', () => {
    expect(gearScore(MAX)).toBe(48);
    expect(GEAR_MAX).toBe(48);
  });

  test('refino de set só pontua a partir do +13', () => {
    expect(gearScore({ arma: { refino: 12 } })).toBe(0);
    expect(gearScore({ arma: { refino: 13 } })).toBe(1);
    expect(gearScore({ arma: { refino: 14 } })).toBe(2);
    expect(gearScore({ arma: { refino: 15 } })).toBe(3);
  });

  test('capa soma refino (+0/+9/+11) e add', () => {
    expect(gearScore({ capa: { refino: 0 } })).toBe(0);
    expect(gearScore({ capa: { refino: 9 } })).toBe(1);
    expect(gearScore({ capa: { refino: 11 } })).toBe(2);
    expect(gearScore({ capa: { refino: 11, add: 'FULL' } })).toBe(5);
  });

  test('runa: fronteira +5 vs +6', () => {
    expect(gearScore({ runa: { refino: null } })).toBe(0);
    expect(gearScore({ runa: { refino: 5 } })).toBe(1);
    expect(gearScore({ runa: { refino: 6 } })).toBe(2);
    expect(gearScore({ runa: { refino: 9 } })).toBe(2);
  });

  test('cythera soma add + refino', () => {
    expect(gearScore({ cythera: { refino: 15, add: 'FULL' } })).toBe(6);
    expect(gearScore({ cythera: { refino: 13, add: 'SUX' } })).toBe(2);
  });

  test('amuletos: cada um pontua por add', () => {
    expect(gearScore({ amuletos: ['SUX', 'SEMI', 'FULL'] })).toBe(6);
    expect(gearScore({ amuletos: ['FULL'] })).toBe(3);
  });

  test('anel/brinco/cinto por tipo', () => {
    expect(gearScore({ anel: 'T1', brinco: 'T2', cinto: null })).toBe(3);
  });

  test('pet só lvl 120/150', () => {
    expect(gearScore({ pet: 120 })).toBe(1);
    expect(gearScore({ pet: 150 })).toBe(2);
    expect(gearScore({ pet: null })).toBe(0);
  });

  test('slotBreakdown soma igual ao total', () => {
    const total = slotBreakdown(MAX).reduce((s, x) => s + x.pontos, 0);
    expect(total).toBe(gearScore(MAX));
    expect(slotBreakdown(MAX)).toHaveLength(16);
  });
});

describe('parseEquipment', () => {
  test('aceita payload válido e normaliza', () => {
    const eq = parseEquipment({ arma: { refino: 15 }, anel: 'T2', amuletos: ['FULL'] });
    expect(eq.arma?.refino).toBe(15);
    expect(eq.anel).toBe('T2');
  });
  test('rejeita refino fora de faixa', () => {
    expect(() => parseEquipment({ arma: { refino: 99 } })).toThrow();
  });
  test('rejeita add/tipo desconhecido', () => {
    expect(() => parseEquipment({ anel: 'T9' })).toThrow();
    expect(() => parseEquipment({ capa: { add: 'MEGA' } })).toThrow();
  });
  test('rejeita mais de 3 amuletos', () => {
    expect(() => parseEquipment({ amuletos: ['SUX', 'SUX', 'SUX', 'SUX'] })).toThrow();
  });
});
