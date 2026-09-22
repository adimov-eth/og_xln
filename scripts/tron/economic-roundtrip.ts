import { getBytes, Wallet, zeroPadValue } from 'ethers';
import type { JAdapter } from '../../core/jurisdiction/adapter';
import { createEmptyBatch } from '../../core/jurisdiction/machine/batch';
import { prepareSignedBatch } from '../../core/hanko/batch';
import { safeStringify } from '../../core/protocol/serialization';

export async function nativeEconomicRoundtrip(adapter: JAdapter, key: string, token: string, data: string): Promise<void> {
  const progress = `${data}/economic-progress.json`;
  if (await Bun.file(progress).exists()) throw new Error('NATIVE_ECONOMIC_ALREADY_STARTED:inspect_saved_progress');
  if (adapter.mode !== 'tron' || !adapter.getCurrentBlockNumber) throw new Error('NATIVE_ECONOMIC_ADAPTER_REQUIRED');
  const owner = new Wallet(`0x${key}`).address;
  const entity = zeroPadValue('0x01', 32);
  const amount = 1_000_000n;
  const reserveBefore = await adapter.getReserves(entity, 1);
  const externalBefore = await adapter.getErc20Balance(token, owner);
  const nonceBefore = await adapter.getEntityNonce(entity);
  if (reserveBefore !== 0n || externalBefore !== 1_000_000_000_000n || nonceBefore !== 0n)
    throw new Error('NATIVE_ECONOMIC_INITIAL_STATE_MISMATCH');
  const before = { reserveBefore, externalBefore, nonceBefore, amount };
  await Bun.write(progress, safeStringify({ stage: 'deposit-submitting', before }, 2));
  const events = await adapter.externalTokenToReserve(getBytes(`0x${key}`), entity, token, amount, { internalTokenId: 1 });
  const deposit = events.find(event => event.name === 'ReserveUpdated');
  if (!deposit) throw new Error('NATIVE_ECONOMIC_DEPOSIT_RECEIPT_MISSING');
  const reserveFunded = await adapter.getReserves(entity, 1);
  if (reserveFunded !== reserveBefore + amount) throw new Error('NATIVE_ECONOMIC_DEPOSIT_DELTA');
  await Bun.write(progress, safeStringify({ stage: 'deposited', before, deposit, reserveFunded }, 2));
  const nonce = await adapter.getEntityNonce(entity);
  const batch = createEmptyBatch();
  batch.reserveToExternalToken.push({ receivingEntity: zeroPadValue(owner, 32), tokenId: 1, amount });
  const signed = prepareSignedBatch(batch, entity, getBytes(`0x${key}`), BigInt(adapter.chainId), adapter.addresses.depository, nonce);
  const withdrawal = await adapter.processBatch(signed.encodedBatch, signed.hankoData, signed.nextNonce);
  const deadline = Date.now() + 15_000;
  while (await adapter.getCurrentBlockNumber() < withdrawal.blockNumber) {
    if (Date.now() >= deadline) throw new Error('NATIVE_ECONOMIC_SOLIDIFICATION_TIMEOUT');
    await Bun.sleep(250);
  }
  const reserveAfter = await adapter.getReserves(entity, 1);
  const externalAfter = await adapter.getErc20Balance(token, owner);
  const nonceAfter = await adapter.getEntityNonce(entity);
  if (reserveAfter !== reserveBefore || externalAfter !== externalBefore || nonceAfter !== nonce + 1n)
    throw new Error(`NATIVE_ECONOMIC_ROUNDTRIP_MISMATCH:${safeStringify({before,reserveAfter,externalAfter,nonceAfter})}`);
  const result = { stage: 'complete', before, reserveFunded, deposit, withdrawal, reserveAfter, externalAfter, nonceAfter };
  await Bun.write(progress, safeStringify(result, 2));
  await Bun.write(`${data}/economic.json`, safeStringify(result, 2));
  console.log('NATIVE_ECONOMIC_VERIFIED', safeStringify(result));
}
