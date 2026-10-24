const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/**
 * Printed batch short code: RFC 4648 base32 (no padding) of the first 8 bytes
 * of the batch ID, per docs/HASHING.md. 8 bytes (64 bits) encode to 13 chars;
 * the final char carries only 4 meaningful bits.
 */
export function shortCodeOf(batchId: string): string {
  const hex = batchId.replace(/^0x/, '').toLowerCase();
  if (hex.length < 16 || !/^[0-9a-f]+$/.test(hex.slice(0, 16))) {
    throw new Error('batchId must be a 0x-prefixed hex string of at least 8 bytes');
  }
  let bits = 0n;
  for (let i = 0; i < 8; i++) {
    bits = (bits << 8n) | BigInt(parseInt(hex.slice(i * 2, i * 2 + 2), 16));
  }
  let code = '';
  for (let i = 12; i >= 0; i--) {
    code += ALPHABET[Number((bits >> BigInt(i * 5)) & 31n)];
  }
  return code;
}

export function isValidShortCode(code: string): boolean {
  return /^[A-Z2-7]{13}$/.test(code.toUpperCase());
}

export function batchIdMatchesShortCode(batchId: string, code: string): boolean {
  try {
    return shortCodeOf(batchId).toUpperCase() === code.toUpperCase();
  } catch {
    return false;
  }
}
