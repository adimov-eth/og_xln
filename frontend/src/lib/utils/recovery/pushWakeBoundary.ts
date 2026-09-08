import { getAddress } from 'ethers';
import type { PushPlatformV1 } from '@xln/core/watchtower/push/types';
const VALID_PLATFORMS = new Set<PushPlatformV1>(['ios', 'android', 'web', 'desktop']);
const MAX_DEVICE_TOKEN_LENGTH = 4096;

export const normalizeRuntimeId = (value: unknown): string => {
  const raw = String(value || '').trim();
  if (!raw) throw new Error('PUSH_RUNTIME_ID_REQUIRED');
  return getAddress(raw).toLowerCase();
};

export const normalizeEntityId = (value: unknown): string => {
  const raw = String(value || '').trim().toLowerCase();
  if (!/^0x[0-9a-f]{64}$/.test(raw)) throw new Error('PUSH_ENTITY_ID_INVALID');
  return raw;
};

export const normalizeAddress = (value: unknown, label: string): string => {
  const raw = String(value || '').trim();
  if (!raw) throw new Error(`${label}_REQUIRED`);
  return getAddress(raw).toLowerCase();
};

export const normalizeChainId = (value: unknown): number => {
  const chainId = Math.floor(Number(value));
  if (!Number.isFinite(chainId) || chainId <= 0) throw new Error('PUSH_CHAIN_ID_INVALID');
  return chainId;
};

export const normalizePlatform = (value: unknown, defaultPlatform: PushPlatformV1): PushPlatformV1 => {
  const platform = String(value || defaultPlatform).trim().toLowerCase() as PushPlatformV1;
  if (!VALID_PLATFORMS.has(platform)) throw new Error('PUSH_PLATFORM_INVALID');
  return platform;
};

export const normalizeDeviceToken = (value: unknown): string => {
  const token = String(value || '').trim();
  if (!token || token.length > MAX_DEVICE_TOKEN_LENGTH) throw new Error('PUSH_TOKEN_INVALID');
  return token;
};

export const normalizeHttpUrl = (value: unknown, label: string): string => {
  const raw = String(value || '').trim();
  if (!raw) throw new Error(`${label}_REQUIRED`);
  const parsed = new URL(raw);
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') throw new Error(`${label}_INVALID`);
  return parsed.toString().replace(/\/+$/, '');
};

export const normalizeTokenHash = (value: unknown): string => {
  const tokenHash = String(value || '').trim().toLowerCase();
  if (!/^0x[0-9a-f]{64}$/.test(tokenHash)) throw new Error('PUSH_TOKEN_HASH_INVALID');
  return tokenHash;
};

export const normalizeTowerUrl = (value: unknown): string => normalizeHttpUrl(value, 'PUSH_TOWER_URL');
