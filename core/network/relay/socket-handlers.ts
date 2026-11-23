import { createStructuredLogger } from '../../support/logger';
import { errorMessage } from '../../support/boundary-guards';
import { pushDebugEvent, removeClient, type RelayStore } from './store';
import {
  forgetRelaySocketRuntimeId,
  isRelaySocketAuthenticated,
  relayRoute,
  type RelayRouterConfig,
} from './router';
import {
  deserializeWsMessage,
  resolveRuntimeWsMaxMessageBytes,
  serializeWsMessage,
  toRuntimeWsBytes,
} from '../p2p/ws-protocol';
import type { createHelloChallengeRegistry } from '../p2p/auth/hello-challenge';
import type { MarketSubscriptionStack } from './market/subscription-types';
import { encodeMarketWireMessage } from './market/wire';
import { decodeRelaySocketFrame, type RelaySocketFrame } from '../../api/server/network/relay-frame';

type RelaySocketDeps<T> = Readonly<{
  relayStore: RelayStore;
  relayHelloChallenges: ReturnType<typeof createHelloChallengeRegistry>;
  marketSubscriptionStack?: MarketSubscriptionStack<Bun.ServerWebSocket<T>>;
  getRouterConfig: () => RelayRouterConfig | undefined;
  wsType: (ws: Bun.ServerWebSocket<T>) => string;
  helloAudience: (ws: Bun.ServerWebSocket<T>) => string | undefined;
  onClose?: (ws: Bun.ServerWebSocket<T>, code: number, reason: string, removedId: string | null) => void;
}>;

const socketLog = createStructuredLogger('relay.socket');

export const createRelaySocketHandlers = <T>(deps: RelaySocketDeps<T>): Bun.WebSocketHandler<T> => {
  const { relayStore, relayHelloChallenges, marketSubscriptionStack, getRouterConfig, wsType, helloAudience, onClose } = deps;
  const decodeFrame = (raw: string | Uint8Array | ArrayBuffer, ws: Bun.ServerWebSocket<T>): RelaySocketFrame => {
    const authenticated = isRelaySocketAuthenticated(ws);
    return marketSubscriptionStack
      ? decodeRelaySocketFrame(raw, authenticated)
      : { kind: 'peer', message: deserializeWsMessage(raw, { authenticated }) };
  };
  return {
    maxPayloadLength: resolveRuntimeWsMaxMessageBytes(),
    open(ws) {
      const audience = helloAudience(ws);
      if (audience !== undefined) relayHelloChallenges.issue(ws, audience);
      pushDebugEvent(relayStore, { event: 'ws_open', details: { wsType: wsType(ws) } });
    },
    message(ws, raw) {
      try {
        const frame = decodeFrame(raw, ws);
        if (frame.kind === 'market') {
          const marketMessage = frame.message;
          Promise.resolve(marketSubscriptionStack?.handleMessage(ws, marketMessage)).catch(error => {
            const reason = errorMessage(error);
            pushDebugEvent(relayStore, {
              event: 'error',
              reason: 'MARKET_HANDLER_EXCEPTION',
              details: { error: reason, msgType: marketMessage.type },
            });
            socketLog.error('relay.market_handler_exception', { error: reason, msgType: marketMessage.type });
            // The peer may be unauthenticated: it gets a fixed code, never internal exception text.
            try {
              ws.send(encodeMarketWireMessage({ type: 'error', error: 'Market handler exception' }));
            } catch (sendError) {
              socketLog.warn('relay.market_error_send_failed', { error: errorMessage(sendError) });
            }
          });
          return;
        }
        const routerConfig = getRouterConfig();
        if (!routerConfig) {
          ws.send(serializeWsMessage({ type: 'error', error: 'Runtime transport not ready' }));
          return;
        }
        const peerMessage = frame.message;
        Promise.resolve(relayRoute(routerConfig, ws, peerMessage, typeof raw === 'string' ? undefined : toRuntimeWsBytes(raw))).catch(error => {
          const reason = errorMessage(error);
          pushDebugEvent(relayStore, {
            event: 'error',
            reason: 'RELAY_HANDLER_EXCEPTION',
            details: {
              error: reason,
              msgType: peerMessage.type,
              from: peerMessage.from,
              to: peerMessage.to,
            },
          });
          socketLog.error('relay.handler_exception', { error: reason, msgType: peerMessage.type });
          try {
            ws.send(serializeWsMessage({ type: 'error', error: 'Relay handler exception' }));
          } catch (sendError) {
            socketLog.warn('relay.error_send_failed', { error: errorMessage(sendError) });
          }
        });
      } catch (error) {
        pushDebugEvent(relayStore, {
          event: 'error',
          reason: 'INVALID_RELAY_MESSAGE',
          details: { error: errorMessage(error) },
        });
        try {
          ws.send(serializeWsMessage({ type: 'error', error: 'Invalid relay message' }));
        } catch (sendError) {
          socketLog.warn('relay.invalid_message_send_failed', { error: errorMessage(sendError) });
        }
      }
    },
    close(ws, code, reason) {
      relayHelloChallenges.forget(ws);
      marketSubscriptionStack?.cleanup(ws);
      forgetRelaySocketRuntimeId(ws);
      const removedId = removeClient(relayStore, ws);
      onClose?.(ws, code, reason, removedId);
    },
  };
};
