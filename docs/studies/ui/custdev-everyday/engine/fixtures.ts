import type { ScenarioId, SpecMode, WalletFixtureState } from '../types.ts';

export const ONE_USD = 1_000_000n;

export const usd = (dollars: number): bigint => BigInt(Math.round(dollars * 1_000_000));

export const microToUsd = (micro: bigint): number => Number(micro) / 1_000_000;

export const formatUsd = (micro: bigint): string => `$${(Number(micro) / 1_000_000).toFixed(2)}`;

export const settledCashOf = (s: WalletFixtureState): bigint =>
  s.onchainMicroUsd + s.reserveMicroUsd + s.securedMicroUsd;

function baseState(specMode: SpecMode): WalletFixtureState {
  return {
    specMode,
    onchainMicroUsd: 0n,
    reserveMicroUsd: 0n,
    securedMicroUsd: 0n,
    arrivingMicroUsd: 0n,
    savingsMicroUsd: 0n,
    savingsApy: '4.2%',
    savingsRiskConsented: false,
    maxFeeMicroUsd: usd(2),
    quotedFeeMicroUsd: usd(0.05),
    autoSettleFeeMicroUsd: usd(0.05),
    hubOnline: true,
    l1SweepBehavior: 'succeed',
    nativeGasWei: 1_000_000_000_000_000n,
    disputeActive: false,
    disputeStartedByUs: false,
    towerEnrolled: true,
    backupExported: false,
    reloadedAfterFailure: false,
    l1SweepAttempted: false,
    peers: [{ id: 'H1', label: 'Primary Hub (H1)', isHub: true, signedMicroUsd: 0n, peerCreditLimitMicroUsd: 0n, ownCreditLimitMicroUsd: usd(250) }],
    externalRequests: [],
    requestLinks: [],
    activity: [],
  };
}

export function createFixtureState(scenarioId: ScenarioId, specMode: SpecMode): WalletFixtureState {
  const s = baseState(specMode);
  if (scenarioId === 'E1a_pay_across_buckets') {
    return { ...s, onchainMicroUsd: usd(35), reserveMicroUsd: usd(45), securedMicroUsd: usd(40) };
  }
  if (scenarioId === 'E1b_pay_fee_above_cap') {
    return { ...s, onchainMicroUsd: usd(35), reserveMicroUsd: usd(45), securedMicroUsd: usd(40), quotedFeeMicroUsd: usd(3.5) };
  }
  if (scenarioId === 'E1c_pay_l1_reject_reload') {
    return { ...s, onchainMicroUsd: usd(90), reserveMicroUsd: usd(10), securedMicroUsd: usd(20), l1SweepBehavior: 'reject' };
  }
  if (scenarioId === 'E2_friends_split_and_settle') {
    return {
      ...s,
      reserveMicroUsd: usd(100),
      securedMicroUsd: usd(80),
      peers: [
        ...s.peers,
        { id: 'alex', label: 'Alex', isHub: false, signedMicroUsd: usd(40), peerCreditLimitMicroUsd: usd(100), ownCreditLimitMicroUsd: usd(100) },
        { id: 'sam', label: 'Sam', isHub: false, signedMicroUsd: usd(-15), peerCreditLimitMicroUsd: usd(100), ownCreditLimitMicroUsd: usd(100) },
        { id: 'jamie', label: 'Jamie', isHub: false, signedMicroUsd: 0n, peerCreditLimitMicroUsd: usd(100), ownCreditLimitMicroUsd: usd(100) },
      ],
    };
  }
  if (scenarioId === 'E3a_newcomer_arriving_and_request' || scenarioId === 'E3b_offline_hub_keeps_arriving') {
    return {
      ...s,
      arrivingMicroUsd: usd(50),
      hubOnline: scenarioId === 'E3a_newcomer_arriving_and_request',
      peers: [
        ...s.peers,
        { id: 'maya', label: 'Maya', isHub: false, signedMicroUsd: 0n, peerCreditLimitMicroUsd: usd(100), ownCreditLimitMicroUsd: usd(100) },
      ],
      activity: [{ id: 'act-1', summary: 'Incoming $50.00 from Maya (finishing...)', kind: 'arriving', amountMicroUsd: usd(50) }],
    };
  }
  if (scenarioId === 'E4_savings_optin_consent') {
    return { ...s, reserveMicroUsd: usd(200), securedMicroUsd: usd(300) };
  }
  if (scenarioId === 'E5a_external_checkout_approve') {
    return {
      ...s,
      reserveMicroUsd: usd(60),
      securedMicroUsd: usd(60),
      externalRequests: [{
        id: 'req_cornercoffee',
        kind: 'cash-spend',
        origin: 'checkout.cornercoffee.nyc',
        appClaim: 'Pay CornerCoffee $25.00 for espresso beans',
        counterparty: 'CornerCoffee-NYC',
        amountMicroUsd: usd(25),
        feeMicroUsd: usd(0.05),
        creditLimitDeltaMicroUsd: 0n,
        unbackedDeltaMicroUsd: 0n,
        expiry: '60 seconds',
        status: 'pending',
      }],
    };
  }
  if (scenarioId === 'E5b_external_bait_reject') {
    return {
      ...s,
      reserveMicroUsd: usd(60),
      securedMicroUsd: usd(60),
      externalRequests: [{
        id: 'req_promohub_bait',
        kind: 'escalate-pro',
        origin: 'rewards.promohub.io',
        appClaim: 'Claim your $50.00 welcome reward!',
        counterparty: 'PromoHub-7',
        amountMicroUsd: 0n,
        feeMicroUsd: 0n,
        creditLimitDeltaMicroUsd: usd(10_000),
        unbackedDeltaMicroUsd: usd(10_000),
        expiry: 'Until revoked',
        status: 'pending',
      }],
    };
  }
  return {
    ...s,
    reserveMicroUsd: usd(100),
    securedMicroUsd: usd(45),
    hubOnline: false,
    nativeGasWei: 0n,
    disputeActive: true,
    disputeStartedByUs: true,
    towerEnrolled: true,
    backupExported: false,
    activity: [{ id: 'act-1', summary: 'Payment provider H1 offline — protection check active', kind: 'recovery', amountMicroUsd: usd(145) }],
  };
}
