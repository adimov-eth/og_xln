import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { decodeRelaySocketFrame } from '../../../api/server/network/relay-frame';
import { serializeWsMessage } from '../../../network/p2p/ws-protocol';
import { encodeMarketWireMessage } from '../../../network/relay/market/wire';

test('a relay socket never decodes a binary non-peer frame as text', () => {
  const market = encodeMarketWireMessage({ type: 'market_snapshot_request', id: 'market-req-1' });
  expect(decodeRelaySocketFrame(market, false)).toMatchObject({ kind: 'market' });
  // The same request sent as bytes used to be decoded to text, twice per frame:
  // an unauthenticated 256 MiB frame cost about 1.5 GB of transient memory.
  expect(() => decodeRelaySocketFrame(new TextEncoder().encode(market), false)).toThrow();
  expect(decodeRelaySocketFrame(serializeWsMessage({ type: 'ping' }), false))
    .toEqual({ kind: 'peer', message: { type: 'ping' } });
});

test('every relay socket server decodes frames through the one relay frame decoder', () => {
  // The orchestrator relay (pm2 xln-server) kept its own copy of the text
  // decode path after the API server was fixed.
  const root = join(import.meta.dir, '..', '..', '..');
  const handlers = readFileSync(join(root, 'network/relay/socket-handlers.ts'), 'utf8');
  expect(handlers).toContain('decodeRelaySocketFrame(');
  expect(handlers).not.toContain('decodeMarketWireRequest');
  for (const path of ['api/server/index.ts', 'network/relay/standalone-server.ts']) {
    const source = readFileSync(join(root, path), 'utf8');
    expect(source, path).toContain('createRelaySocketHandlers<');
    expect(source, path).not.toContain('decodeMarketWireRequest');
  }
  const orchestrator = readFileSync(join(root, 'orchestrator/orchestrator.ts'), 'utf8');
  expect(orchestrator).toContain('websocket: createRelaySocketHandlers<OrchestratorWebSocket[');
  expect(orchestrator).not.toContain('decodeMarketWireRequest');
});
