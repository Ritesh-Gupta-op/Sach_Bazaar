import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { batchIdMatchesShortCode, isValidShortCode, shortCodeOf } from './shortCode.ts';

describe('shortCodeOf', () => {
  it('produces 13 uppercase RFC 4648 base32 characters', () => {
    const code = shortCodeOf('0x' + 'ab'.repeat(32));
    assert.match(code, /^[A-Z2-7]{13}$/);
  });

  it('depends only on the first 8 bytes of the batch id', () => {
    const batchId = '0x' + '1234abcdef567890ff'.padEnd(64, '0');
    const samePrefix = batchId.slice(0, 18) + '99'.repeat(24);
    assert.equal(shortCodeOf(batchId), shortCodeOf(samePrefix));
  });

  it('changes when the first 8 bytes change', () => {
    assert.notEqual(shortCodeOf('0x' + '01'.repeat(32)), shortCodeOf('0x' + '02'.repeat(32)));
  });

  it('rejects non-hex input', () => {
    assert.throws(() => shortCodeOf('not-hex'));
    assert.throws(() => shortCodeOf('0xzz'));
  });
});

describe('isValidShortCode', () => {
  it('accepts 13 base32 chars and rejects everything else', () => {
    assert.equal(isValidShortCode('AAAAAAAAAAAAA'), true);
    assert.equal(isValidShortCode('aaaaaaaaaaaaa'), true); // case-insensitive input
    assert.equal(isValidShortCode('AAAAAAAAAAAA'), false); // too short
    assert.equal(isValidShortCode('AAAAAAAAAAAA1'), false); // 1 is not in the alphabet
    assert.equal(isValidShortCode('AAAAAAAAAAAAAB'), false); // too long
  });
});

describe('batchIdMatchesShortCode', () => {
  it('round-trips a batch id through its short code', () => {
    const batchId = '0x' + 'cd'.repeat(32);
    assert.equal(batchIdMatchesShortCode(batchId, shortCodeOf(batchId)), true);
    assert.equal(batchIdMatchesShortCode(batchId, 'BBBBBBBBBBBBB'), false);
  });

  it('returns false instead of throwing for malformed ids', () => {
    assert.equal(batchIdMatchesShortCode('nope', 'AAAAAAAAAAAAA'), false);
  });
});
