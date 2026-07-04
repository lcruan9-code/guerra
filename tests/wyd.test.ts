import { describe, expect, test } from 'vitest';
import { CLASSES, SPECS_BY_CLASS, isValidCombo } from '../lib/wyd';

describe('domínio WYD', () => {
  test('tem as 4 classes', () => {
    expect(CLASSES).toEqual(['TK', 'BM', 'HT', 'FM']);
  });

  test('especializações por classe seguem a regra do jogo', () => {
    expect(SPECS_BY_CLASS.TK).toEqual(['FISICO', 'MAGO']);
    expect(SPECS_BY_CLASS.BM).toEqual(['FISICO', 'MAGO']);
    expect(SPECS_BY_CLASS.HT).toEqual(['FISICO']);
    expect(SPECS_BY_CLASS.FM).toEqual(['CANCEL', 'BLOOD', 'MAGO']);
  });

  test('aceita combinações válidas', () => {
    expect(isValidCombo('TK', 'FISICO')).toBe(true);
    expect(isValidCombo('FM', 'BLOOD')).toBe(true);
    expect(isValidCombo('HT', 'FISICO')).toBe(true);
  });

  test('rejeita combinações inválidas', () => {
    expect(isValidCombo('HT', 'MAGO')).toBe(false);
    expect(isValidCombo('FM', 'FISICO')).toBe(false);
    expect(isValidCombo('XX', 'FISICO')).toBe(false);
    expect(isValidCombo('', '')).toBe(false);
  });
});
