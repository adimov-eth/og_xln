import type { EntityTx } from '@xln/core/types/entity-tx';
import {
  buildSignSheet,
  fingerprint,
  formatExpiry,
  type SignSheetSource,
  type SignSheetView,
} from '../components/Entity/core/sign-sheet';
import { buildStewardTxs, type StewardPin, type VerifiedStewardRequest } from './steward-request';

export type StewardSheet = Readonly<{ sheet: SignSheetView; txs: readonly EntityTx[] }>;

/** One object: the batch the sheet renders is the batch Sign sends. */
export const stewardSheet = (
  request: VerifiedStewardRequest,
  pin: StewardPin,
  source: SignSheetSource,
  now: number,
): StewardSheet => {
  const { body } = request;
  const txs = buildStewardTxs(body);
  const requester = pin.label || fingerprint(body.stewardEntityId);
  return {
    txs,
    sheet: buildSignSheet(
      {
        id: body.nonce,
        requester,
        origin: `Signed by your pinned steward · ${formatExpiry(body.expiresAt, now)}`,
        txs,
        note: body.note,
        terms: [
          ['steward', body.stewardEntityId],
          ['signer', body.stewardSigner],
          ['for', body.entityId],
          ['nonce', body.nonce],
          ['expires', new Date(body.expiresAt).toISOString()],
          ['signature', request.signature],
        ],
      },
      source,
    ),
  };
};
