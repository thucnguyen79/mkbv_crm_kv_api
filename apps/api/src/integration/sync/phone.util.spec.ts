import { normalizePhone } from './phone.util';

describe('normalizePhone', () => {
  it.each([
    ['0912345678', '0912345678'],
    ['+84912345678', '0912345678'],
    ['84912345678', '0912345678'],
    ['  0912 345 678  ', '0912345678'],
    ['0912-345-678', '0912345678'],
    ['01234567890', '01234567890'], // old 11-digit format
    ['(+84) 912.345.678', '0912345678'],
  ])('normalizes %s → %s', (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });

  it.each([
    null,
    undefined,
    '',
    'abc',
    '1234567', // too short after normalization
    '091234567890123', // too long
    '912345678', // no leading 0 / 84 / +84
  ])('rejects invalid input %s', (input) => {
    expect(normalizePhone(input)).toBeNull();
  });
});
