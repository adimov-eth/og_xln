import { describe, expect, test } from 'bun:test';
import { createRequire } from 'node:module';
import { ethers } from 'ethers';
import { createXlnJsonRpcProvider, resolveJAdapterPrivateKey } from '../../../jurisdiction/adapter';
import { createTronSigner, TronSigner } from '../../../jurisdiction/adapter/operations/tron-signer';

const PRIVATE_KEY = `0x${'11'.repeat(32)}`;
// Match the production boundary. TronWeb 6.4's published ESM protobuf bundle
// relies on undeclared global `proto`; its CommonJS export owns that bootstrap
// correctly and remains deterministic when Bun loads the full test graph.
const tronWebModule: typeof import('tronweb') = createRequire(import.meta.url)('tronweb');
const { TronWeb } = tronWebModule;

describe('TRON signer boundary', () => {
  test('requires an explicit watch-only boundary when a public-chain signer is absent', async () => {
    const config = {
      mode: 'tron' as const,
      chainId: 3448148188,
    };
    expect(() => resolveJAdapterPrivateKey(config)).toThrow('privateKey is required');
    expect(resolveJAdapterPrivateKey({ ...config, watchOnly: true })).toBeUndefined();
  });

  test('derives the same EVM caller from Ethereum and TRON address formats', async () => {
    const provider = createXlnJsonRpcProvider('http://127.0.0.1:1/jsonrpc', 3448148188);
    const signer = await createTronSigner({
      provider,
      privateKey: PRIVATE_KEY,
      rpcUrl: 'http://127.0.0.1:1/jsonrpc',
    });
    expect(await signer.getAddress()).toBe(new ethers.Wallet(PRIVATE_KEY).address);
    await provider.destroy();
  });

  test('refuses Ethereum raw transaction signing at the TRON boundary', async () => {
    const provider = createXlnJsonRpcProvider('http://127.0.0.1:1/jsonrpc', 3448148188);
    const signer = await createTronSigner({
      provider,
      privateKey: PRIVATE_KEY,
      rpcUrl: 'http://127.0.0.1:1/jsonrpc',
    });
    await expect(signer.signTransaction({})).rejects.toThrow('TRON_PROTOBUF_TRANSACTION_REQUIRED');
    await provider.destroy();
  });

  test('native TRX transfer bypasses smart-contract energy estimation', async () => {
    const provider = createXlnJsonRpcProvider('http://127.0.0.1:1/jsonrpc', 3448148188);
    const realWeb = new TronWeb({ fullHost: 'http://127.0.0.1:1', privateKey: PRIVATE_KEY.slice(2) });
    const nativeTransfer = await realWeb.transactionBuilder.sendTrx(
      `41${'22'.repeat(20)}`, 1, realWeb.defaultAddress.hex,
      { blockHeader: { ref_block_bytes: '000d', ref_block_hash: 'c6a630b3da97ccf2', timestamp: 1_788_566_778_000, expiration: 1_788_566_838_000 } },
    );
    const transactionHash = `0x${nativeTransfer.txID}`;
    let nativeReceiptReads = 0;
    const transactionResponse = new ethers.TransactionResponse({
      blockNumber: 20,
      blockHash: ethers.ZeroHash,
      hash: transactionHash,
      index: 0,
      type: 0,
      to: '0x2222222222222222222222222222222222222222',
      from: new ethers.Wallet(PRIVATE_KEY).address,
      nonce: 0,
      gasLimit: 0n,
      gasPrice: 0n,
      maxPriorityFeePerGas: null,
      maxFeePerGas: null,
      data: '0x',
      value: 1n,
      chainId: 3448148188n,
      signature: new ethers.Wallet(PRIVATE_KEY).signingKey.sign(ethers.ZeroHash),
      accessList: null,
      authorizationList: null,
    }, provider);
    Object.defineProperty(provider, 'getTransaction', {
      value: async (hash: string) => {
        if (nativeReceiptReads < 2) throw new Error('PENDING_TRON_JSON_RPC_HAS_EMPTY_HEX_NUMBERS');
        return hash === transactionHash ? transactionResponse : null;
      },
    });
    const ownerHex = `41${new ethers.Wallet(PRIVATE_KEY).address.slice(2)}`;
    const owner = TronWeb.address.fromHex(ownerHex);
    let sendTrxCalls = 0;
    let estimateEnergyCalls = 0;
    class FakeTronWeb {
      utils = realWeb.utils;
      defaultAddress = { base58: owner };
      address = {
        toHex: () => ownerHex,
        fromHex: (value: string) => value,
      };
      transactionBuilder = {
        sendTrx: async () => {
          sendTrxCalls += 1;
          return nativeTransfer;
        },
        estimateEnergy: async () => {
          estimateEnergyCalls += 1;
          throw new Error('must not estimate Energy for TRX');
        },
      };
      trx = {
        sign: realWeb.trx.sign.bind(realWeb.trx),
        sendHexTransaction: async () => ({ result: true }),
        getUnconfirmedTransactionInfo: async () => ++nativeReceiptReads === 1
          ? {} : { id: nativeTransfer.txID, blockNumber: 20 },
      };
    }
    const signer = new TronSigner({
      provider,
      privateKey: PRIVATE_KEY,
      rpcUrl: 'http://127.0.0.1:1/jsonrpc',
    }, FakeTronWeb as unknown as typeof TronWeb);

    const response = await signer.sendTransaction({
      to: '0x2222222222222222222222222222222222222222',
      value: 1n,
    });
    expect(response).toBe(transactionResponse);
    expect(response.hash).toBe(transactionHash);
    expect(sendTrxCalls).toBe(1);
    expect(estimateEnergyCalls).toBe(0);
    expect(nativeReceiptReads).toBe(2);
    await provider.destroy();
  });
});
