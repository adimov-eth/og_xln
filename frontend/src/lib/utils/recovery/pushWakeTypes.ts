import type { PushPlatformV1 } from '@xln/core/watchtower/push/types';
export type PushWakeDeviceToken = {
  token: string;
  platform: PushPlatformV1;
  source: 'desktop-bridge' | 'native' | 'web-push';
};

export type PushWakeTarget = {
  runtimeId: string;
  entityId: string;
  chainId: number;
  depositoryAddress: string;
  rpcUrl: string;
};

export type PushWakeRegistrationRecord = PushWakeTarget & {
  towerUrl: string;
  tokenHash: string;
  platform: PushPlatformV1;
  updatedAt: number;
};
