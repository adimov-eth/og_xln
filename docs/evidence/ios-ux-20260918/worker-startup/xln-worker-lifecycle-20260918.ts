import { TsAccountWorkerCoordinator } from '/Users/zigota/xln/core/rscore/ts-worker/coordinator';

// A runtime lifecycle diagnostic, not a payment/parity acceptance test.
const started = performance.now();
for (let wave = 0; wave < 3; wave++) {
  const pools: TsAccountWorkerCoordinator[] = [];
  for (let entity = 0; entity < 16; entity++) {
    const pool = await TsAccountWorkerCoordinator.create({
      ownerEntityId: `0x${(entity + 1).toString(16).padStart(64, '0')}`,
      workerCount: 8,
      accounts: new Map(),
    });
    pools.push(pool);
    console.log(JSON.stringify({ wave, initialized: pools.length, workers: pools.length * 8 }));
  }
  for (const pool of pools) pool.close();
  await Bun.sleep(200);
  console.log(JSON.stringify({ wave, closed: pools.length, elapsedMs: performance.now() - started }));
}
console.log(JSON.stringify({ completed: true, pools: 48, workers: 384, elapsedMs: performance.now() - started }));
