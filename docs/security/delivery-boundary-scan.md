# Runtime Delivery Boundary Scan

Last refreshed: 2026-09-05.

Run:

```bash
bun run security:delivery-boundary
```

This is an executable source-shape and behavior scan for the runtime delivery
boundary. It keeps entity-input transport decisions in one typed result shape
instead of allowing boolean sends, string parsing, or duplicated retry logic to
creep back into call sites.

## Current Result

- Authenticated direct sessions carry financial entity inputs. Relay sockets
  carry discovery/control traffic; a missing recipient never selects relay delivery.
- Recipient readiness is separate from transport authentication. Before a
  recipient is ready, the existing committed Runtime outbox retains its exact
  output units; an authenticated readiness change wakes the same Runtime writer.
- Raw `sendEntityInputsRaw()` is limited to the P2P adapter and websocket client.
- Runtime routing, RuntimeP2P, relay-router, relay-store, direct runtime
  websocket, hub-node, and market-maker node all expose or consume
  `DeliveryResult` metadata.
- Retry/drop/fatal decisions live behind shared delivery helpers:
  `isDeliveryDelivered`, `isDeliveryRecipientNotReady`, `shouldRetryDelivery`, `requireDeliveryDelivered`, and
  `classifyUndeliveredDelivery`.
- Only explicit readiness deferral proves no bytes were sent. A send failure,
  invalid route, or invalid signature remains terminal. Partial acceptance retires
  only accepted units and retains the original order of remaining outputs.

## Open Manual Review

- This scan proves the source boundary and helper semantics. It does not prove
  liveness under every relay partition or adversarial ACK interleaving.
- ACK interpretation still belongs to entity/account consensus tests. Delivery
  only proves encrypted transport acceptance, deferral, retry, or terminal
  failure metadata.
