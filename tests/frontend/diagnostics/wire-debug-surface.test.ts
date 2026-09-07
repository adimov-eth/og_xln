import { describe, expect, test } from 'bun:test';

import { wireDebug } from '../../../frontend/src/lib/utils/runtime/wireDebug';
import { XLN_PROTOCOL_VERSION } from '../../../core/protocol/version';
import { serializeWsMessage } from '../../../core/network/p2p/ws-protocol';
import { encodeRuntimeAdapterMessage } from '../../../core/api/runtime-adapter/codec';

describe('browser wire debug surface', () => {
  test('decodes exact peer and rAdapter wire values without changing production codecs', () => {
    const peer = wireDebug.encodeWs({ type: 'ping' });
    expect(wireDebug.protocolVersion).toBe(XLN_PROTOCOL_VERSION);
    expect(peer).toEqual(serializeWsMessage({ type: 'ping' }));
    expect(wireDebug.decode(peer)).toEqual({ type: 'ping', v: XLN_PROTOCOL_VERSION });
    expect(wireDebug.decodeWs(peer)).toEqual({ type: 'ping' });

    const adapter = wireDebug.encodeRadapter({
      v: XLN_PROTOCOL_VERSION,
      op: 'tick',
      height: 9,
      commandReady: true,
      commandReadyReason: null,
    });
    const expected = {
      v: XLN_PROTOCOL_VERSION,
      op: 'tick',
      height: 9,
      commandReady: true,
      commandReadyReason: null,
    } as const;
    expect(adapter).toEqual(encodeRuntimeAdapterMessage(expected));
    expect(wireDebug.decodeRadapter(adapter)).toEqual(expected);
  });

  test('keeps tagged JSON readable and BigInt-safe', () => {
    const json = wireDebug.stringifyJson({ amount: 7n });
    expect(json).toContain('"__xlnType":"BigInt"');
    expect(wireDebug.parseJson(json)).toEqual({ amount: 7n });
  });
});
