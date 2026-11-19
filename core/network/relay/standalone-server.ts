/**
 * Standalone relay process backed by the same relay router as core/api/server/index.ts.
 */

import { createRelayStore, type RelayStore } from './store';
import type { RelayRouterConfig } from './router';
import { createRelaySocketHandlers } from './socket-handlers';
import { canonicalizeRuntimeWsAudience } from '../p2p/ws-protocol';
import { normalizeRuntimeId } from '../../protocol/identity/runtime-id';
import { createStructuredLogger } from '../../support/logger';
import { createHelloChallengeRegistry } from '../p2p/auth/hello-challenge';
import { readCliOption } from '../../config/cli';

type StandaloneRelayOptions = {
  host?: string;
  port: number;
  serverId: string;
  audience?: string;
  serverRuntimeId?: string;
};

export type StandaloneRelayServer = {
  server: Bun.Server<undefined>;
  store: RelayStore;
  close: () => void;
};

const relayStandaloneLog = createStructuredLogger('relay.standalone');

export const startStandaloneRelayServer = (options: StandaloneRelayOptions): StandaloneRelayServer => {
  const store = createRelayStore(options.serverId);
  const localRuntimeId = normalizeRuntimeId(options.serverRuntimeId || options.serverId) || options.serverId;
  const helloChallenges = createHelloChallengeRegistry();
  let serverRef: Bun.Server<undefined> | null = null;
  let relayAudience = '';

  const routerConfig: RelayRouterConfig = {
    store,
    localRuntimeId,
    send: (ws, data) => ws.send(data),
    consumeHelloChallenge: (ws, challenge) => helloChallenges.consume(ws, challenge),
  };

  const server = Bun.serve<undefined>({
    hostname: options.host || '0.0.0.0',
    port: options.port,
    maxRequestBodySize: 1024 * 1024,
    fetch(request) {
      if (request.headers.get('upgrade') !== 'websocket') {
        return new Response('XLN relay websocket endpoint', { status: 200 });
      }
      if (serverRef?.upgrade(request)) return undefined;
      return new Response('WebSocket upgrade failed', { status: 400 });
    },
    websocket: createRelaySocketHandlers<undefined>({
      relayStore: store,
      relayHelloChallenges: helloChallenges,
      getRouterConfig: () => routerConfig,
      wsType: () => 'relay',
      helloAudience: () => relayAudience,
    }),
  });

  serverRef = server;
  const audienceHost = !options.host || options.host === '0.0.0.0' || options.host === '::'
    ? '127.0.0.1'
    : options.host;
  relayAudience = canonicalizeRuntimeWsAudience(
    options.audience || `ws://${audienceHost}:${server.port}/`,
  );
  relayStandaloneLog.info('service.listen', {
    serverId: options.serverId,
    host: options.host || '0.0.0.0',
    port: server.port,
  });

  return {
    server,
    store,
    close: () => server.stop(true),
  };
};

if (import.meta.main) {
  const args = process.argv;
  const port = Number(readCliOption(args, '--port', process.env['WS_PORT'] || '8787'));
  const host = readCliOption(args, '--host', process.env['WS_HOST'] || '0.0.0.0');
  const serverId = process.env['WS_SERVER_ID'] || 'relay';
  startStandaloneRelayServer({
    host,
    port,
    serverId,
    ...(process.env['RELAY_URL'] ? { audience: process.env['RELAY_URL'] } : {}),
  });
}
