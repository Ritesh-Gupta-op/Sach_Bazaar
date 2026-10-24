import { describe, expect, it } from 'vitest';
import { formatTimestamp, kg, rupeesPerKg, shortenHex } from './format';

describe('format helpers', () => {
  it('converts paise to rupee strings', () => {
    expect(rupeesPerKg(1000)).toBe('₹10.00');
    expect(rupeesPerKg(125)).toBe('₹1.25');
  });

  it('converts grams to kilograms', () => {
    expect(kg(25_000)).toBe('25.0 kg');
    expect(kg(18_500)).toBe('18.5 kg');
  });

  it('shortens hex with an ellipsis and keeps both ends', () => {
    const hex = '0x' + 'ab'.repeat(32);
    expect(shortenHex(hex, 4)).toBe(`0xabab…${hex.slice(-4)}`);
  });

  it('formats timestamps as locale strings', () => {
    expect(formatTimestamp('2026-10-24T17:43:23.000Z')).toMatch(/2026/);
  });
});
