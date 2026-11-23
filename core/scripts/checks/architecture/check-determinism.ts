import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { buildScenarioIsolatedEnv } from '../../../scenarios/harness/scenario-isolation';
import { runTextRule } from '../policy/check-text-rules';

async function main(): Promise<void> {
  if (!runTextRule('determinism')) throw new Error('static determinism guard failed');
  // Runtime resolves its storage root on import. Own a fresh directory before
  // loading it; scenario recovery must never open a previous run's WAL.
  const dbRoot = mkdtempSync(path.join(tmpdir(), 'xln-determinism-'));
  process.env = buildScenarioIsolatedEnv(process.env, dbRoot, null);
  const { runDeterminismTests } = await import('../../../scenarios/runner/determinism');
  console.log(`Determinism storage: ${dbRoot}`);
  await runDeterminismTests(() => {
    rmSync(dbRoot, { recursive: true, force: true });
    mkdirSync(dbRoot, { recursive: true });
  });
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.log('check-determinism failed:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
