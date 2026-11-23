import { toRuntimeHeight, toUnixMs, type EntityHeight, type UnixS, asTokenId, toUnixS, type UnixMs, type TokenId } from '../../../../protocol/units';
import { toEntityId, toRuntimeId, type RuntimeId, type SignerId } from '../../../../protocol/identity';

import { toFrameHash, type StateHash } from '../../../../protocol/hashes';

// @ts-expect-error
export const entityIsNotSigner: SignerId = toEntityId(`0x${'11'.repeat(32)}`);
// @ts-expect-error
export const runtimeIsNotEntitySigner: SignerId = toRuntimeId(`0x${'22'.repeat(20)}`);
// @ts-expect-error
export const millisecondsAreNotSeconds: UnixS = toUnixMs(1_000);
// @ts-expect-error
export const runtimeHeightIsNotEntityHeight: EntityHeight = toRuntimeHeight(1);
// @ts-expect-error
export const plainStringCannotMintRuntimeAuthority: RuntimeId = `0x${'33'.repeat(20)}`;
// @ts-expect-error
export const frameHashIsNotStateRoot: StateHash = toFrameHash(`0x${'55'.repeat(32)}`);


// @ts-expect-error
export const secondsAreNotMilliseconds: UnixMs = toUnixS(1);
// @ts-expect-error
export const millisecondsAreNotTokens: TokenId = toUnixMs(1);
// @ts-expect-error
export const tokensAreNotSeconds: UnixS = asTokenId(1);
// @ts-expect-error
export const numbersCannotMintTokens: TokenId = 1;

import { compareEntityIds } from '../../../../protocol/identity/entity-id';
import { crossJDeadlines } from '../../../../extensions/cross-j/deadlines';
// @ts-expect-error
compareEntityIds(toRuntimeId(`0x${'22'.repeat(20)}`), toEntityId(`0x${'11'.repeat(32)}`));
// @ts-expect-error
crossJDeadlines(toUnixS(1000));
