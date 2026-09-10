import { describe, expect, test } from 'bun:test';
import { ethers } from 'ethers';

import {
  readAuthenticatedReceiptRange,
  type RpcBatchCall,
} from '../../../jurisdiction/adapter/receipt-root';

const zeroBloom = `0x${'00'.repeat(256)}`;
const hashFor = (height: number): string => `0x${height.toString(16).padStart(64, '0')}`;

const blockFor = (height: number) => ({
  number: ethers.toQuantity(height),
  hash: hashFor(height),
  parentHash: height === 1 ? `0x${'00'.repeat(32)}` : hashFor(height - 1),
  receiptsRoot: `0x${'00'.repeat(32)}`,
  logsBloom: zeroBloom,
  transactions: [],
});

describe('authenticated J watcher RPC batching', () => {
  test.each([256, 2048])('reads %i headers in bounded RPC batches with the complete reorg fence', async (rangeSize) => {
    let scalarCalls = 0;
    const batches: RpcBatchCall[][] = [];
    const send = async (): Promise<unknown> => {
      scalarCalls += 1;
      throw new Error('SCALAR_RPC_MUST_NOT_RUN');
    };
    const sendBatch = async (calls: readonly RpcBatchCall[]): Promise<unknown[]> => {
      batches.push(calls.map((call) => ({ method: call.method, params: [...call.params] })));
      return calls.map((call) => blockFor(Number(BigInt(String(call.params[0])))));
    };

    const result = await readAuthenticatedReceiptRange(
      send,
      2,
      rangeSize + 1,
      ['0x000000000000000000000000000000000000dEaD'],
      {},
      sendBatch,
    );

    expect(result.headers).toHaveLength(rangeSize);
    expect(result.logs).toEqual([]);
    expect(scalarCalls).toBe(0);
    expect(batches.length).toBe(2 * Math.ceil((rangeSize + 1) / 128));
    expect(batches.every((batch) => batch.length <= 128)).toBe(true);
    expect(batches.reduce((total, batch) => total + batch.length, 0)).toBe(2 * (rangeSize + 1));
    expect(batches.every((batch) => batch.every((call) => call.method === 'eth_getBlockByNumber'))).toBe(true);
  });
});
