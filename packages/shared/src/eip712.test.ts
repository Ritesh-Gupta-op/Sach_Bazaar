import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { ethers } from 'ethers';
import { aiAttestationTypes, createBatchTypes, handoverTypes, saleTypes } from './eip712.ts';

/**
 * Drift guard: the canonical type string built from these TypeScript
 * definitions must hash identically to the typehash strings inside
 * BatchRegistry.sol. If either side changes without the other, clients would
 * produce signatures the contract rejects.
 */
function canonicalType([name, fields]: [string, { name: string; type: string }[]]): string {
  return `${name}(${fields.map((f) => `${f.type} ${f.name}`).join(',')})`;
}

describe('eip712 types match the contract typehashes', () => {
  const sol = readFileSync(join(import.meta.dirname, '..', '..', '..', 'packages', 'contracts', 'contracts', 'BatchRegistry.sol'), 'utf8');

  const solTypehashes = new Map<string, string>();
  for (const match of sol.matchAll(/keccak256\(\s*"([A-Za-z]+)\(([^)]*)\)"/g)) {
    solTypehashes.set(match[1], `${match[1]}(${match[2]})`);
  }

  const tsTypes = [createBatchTypes, handoverTypes, aiAttestationTypes, saleTypes].map((t) =>
    Object.entries(t)[0],
  ) as [string, { name: string; type: string }[]][];

  it('the contract declares all four typehashes', () => {
    assert.deepEqual([...solTypehashes.keys()].sort(), ['AIAttestation', 'CreateBatch', 'Handover', 'Sale']);
  });

  for (const entry of tsTypes) {
    const [name] = entry;
    it(`${name} canonical type hashes identically to the contract`, () => {
      const fromTs = canonicalType(entry);
      const fromSol = solTypehashes.get(name);
      assert.ok(fromSol, `${name} missing in BatchRegistry.sol`);
      assert.equal(
        ethers.keccak256(ethers.toUtf8Bytes(fromTs)),
        ethers.keccak256(ethers.toUtf8Bytes(fromSol)),
        `TS: ${fromTs}\nSOL: ${fromSol}`,
      );
    });
  }
});
