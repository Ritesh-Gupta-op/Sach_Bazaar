import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const contractNames = ['SachAccess', 'FarmerRegistry', 'BatchRegistry', 'MockUSDC', 'PaymentPool'] as const;
const root = join(__dirname, '..');
const output = join(root, '..', 'shared', 'src', 'abis');

async function main(): Promise<void> {
  await mkdir(output, { recursive: true });
  for (const name of contractNames) {
    const artifactPath = join(root, 'artifacts', 'contracts', `${name}.sol`, `${name}.json`);
    const artifact = JSON.parse(await readFile(artifactPath, 'utf8')) as { abi: unknown };
    await writeFile(join(output, `${name}.json`), `${JSON.stringify(artifact.abi, null, 2)}\n`);
  }
}

void main();
