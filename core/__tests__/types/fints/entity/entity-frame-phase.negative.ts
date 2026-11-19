import type { EntityFrame } from '../../../../entity/types';
import type {
  CertifiedEntityFrame,
  LockedEntityFrame,
} from '../../../../entity/consensus/frame/phase-views';

declare const frame: EntityFrame;

// @ts-expect-error
export const illegalLockedFromUnknownPhase: LockedEntityFrame = frame;
// @ts-expect-error
export const illegalCertifiedFromUnknownPhase: CertifiedEntityFrame = frame;
