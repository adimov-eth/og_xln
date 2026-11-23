import type { EverydayDisputeNotice } from '@xln/frontend/lib/everyday/everyday-projection';
import { useRecoveryShieldNotice } from '../../runtime/use-everyday-wallet';

export function EverydayRecoveryNotice({
  disputes,
  hasZeroL1Gas,
  testId = 'everyday-recovery-notice',
}: {
  disputes: readonly Pick<EverydayDisputeNotice, 'needsL1GasForUnilateralExit'>[];
  hasZeroL1Gas: boolean;
  testId?: string;
}) {
  const shield = useRecoveryShieldNotice(disputes, hasZeroL1Gas);
  return (
    <div
      className="everyday-shield-notice"
      role="status"
      data-testid={testId}
      data-category={shield.category}
    >
      {shield.summary}
    </div>
  );
}
