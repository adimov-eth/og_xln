/**
 * Shared managed-Anvil fixture for tests that need a real jurisdiction chain.
 *
 * RPC is the only jurisdiction backend, so a test that used to reach for an
 * in-process EVM boots a disposable Anvil on an ephemeral port instead. Each
 * fixture owns its own port, state directory and chain id, so parallel test
 * files never share a chain.
 */
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createJAdapter, createXlnJsonRpcProvider } from '../../jurisdiction/adapter';
import type { JAdapter } from '../../jurisdiction/adapter/types';

export type ManagedAnvil = {
  child: ChildProcessWithoutNullStreams;
  rpcUrl: string;
  chainId: number;
  root: string;
  stderr: string;
};

const reservePort = async (): Promise<number> => new Promise((resolve, reject) => {
  const server = createServer();
  server.once('error', reject);
  server.listen(0, '127.0.0.1', () => {
    const address = server.address();
    if (!address || typeof address === 'string') {
      server.close();
      reject(new Error('TEST_ANVIL_PORT_RESERVATION_FAILED'));
      return;
    }
    server.close(error => (error ? reject(error) : resolve(address.port)));
  });
});

export const startAnvil = async (options?: {
  chainId?: number;
  label?: string;
}): Promise<ManagedAnvil> => {
  const chainId = options?.chainId ?? 31_337;
  const port = await reservePort();
  const root = await mkdtemp(join(tmpdir(), `xln-test-anvil-${options?.label ?? 'chain'}-`));
  const managed: ManagedAnvil = {
    child: spawn('anvil', [
      '--host', '127.0.0.1',
      '--port', String(port),
      '--chain-id', String(chainId),
      '--block-gas-limit', '60000000',
      '--prune-history', '256',
      '--silent',
      '--state', join(root, 'state.json'),
    ], { env: { ...process.env, TMPDIR: root } }),
    rpcUrl: `http://127.0.0.1:${port}`,
    chainId,
    root,
    stderr: '',
  };
  managed.child.stderr.on('data', chunk => { managed.stderr += String(chunk); });
  const provider = createXlnJsonRpcProvider(managed.rpcUrl);
  try {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      try {
        if ((await provider.getNetwork()).chainId === BigInt(chainId)) return managed;
      } catch {
        // The process is still starting; the bounded loop is the timeout.
      }
      await Bun.sleep(50);
    }
    throw new Error(`TEST_ANVIL_NOT_READY:${managed.stderr}`);
  } finally {
    await provider.destroy();
  }
};

export const stopAnvil = async (managed: ManagedAnvil): Promise<void> => {
  if (managed.child.exitCode === null && managed.child.signalCode === null) {
    managed.child.kill('SIGTERM');
    await Promise.race([
      new Promise<void>(resolve => managed.child.once('exit', () => resolve())),
      Bun.sleep(3_000).then(() => managed.child.kill('SIGKILL')),
    ]);
  }
  await rm(managed.root, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
};

/** Give an address a native balance on a managed dev chain. */
export const fundAddress = async (
  adapter: JAdapter,
  address: string,
  wei: bigint,
): Promise<void> => {
  const provider = adapter.provider as { send(method: string, params: unknown[]): Promise<unknown> };
  await provider.send('anvil_setBalance', [address, `0x${wei.toString(16)}`]);
};

/** Boot an Anvil and deploy the full contract stack against it. */
export const startAnvilStack = async (options?: {
  chainId?: number;
  label?: string;
}): Promise<{ anvil: ManagedAnvil; adapter: JAdapter; close: () => Promise<void> }> => {
  const anvil = await startAnvil(options);
  try {
    const adapter = await createJAdapter({
      mode: 'rpc',
      chainId: anvil.chainId,
      rpcUrl: anvil.rpcUrl,
    });
    await adapter.deployStack();
    return {
      anvil,
      adapter,
      close: async () => {
        await adapter.close();
        await stopAnvil(anvil);
      },
    };
  } catch (error) {
    await stopAnvil(anvil);
    throw error;
  }
};
