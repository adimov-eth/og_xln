import { toSvg } from 'jdenticon';

import { extractNumberFromEntityId } from '../entity/factory';

export const hashToAvatar = (seed: string, size = 40): string =>
  `data:image/svg+xml,${encodeURIComponent(toSvg(String(seed || '').trim().toLowerCase(), size))}`;

export const generateEntityAvatar = (entityId: string): string =>
  hashToAvatar(entityId, 40);

export const generateSignerAvatar = (signerId: string): string =>
  hashToAvatar(signerId, 32);

export const getEntityDisplayInfo = (
  entityId: string,
): { name: string; avatar: string; type: 'numbered' | 'lazy' } => {
  if (!entityId) return { name: 'Entity (undefined)', avatar: '❓', type: 'numbered' };
  return {
    name: `Entity #${extractNumberFromEntityId(entityId)}`,
    avatar: generateEntityAvatar(entityId),
    type: 'numbered',
  };
};

export const getSignerDisplayInfo = (
  signerId: string,
): { name: string; address: string; avatar: string } => {
  return {
    name: signerId,
    address: signerId,
    avatar: generateSignerAvatar(signerId),
  };
};

export const getEntityShortId = (entityId: string): string => {
  if (!entityId || entityId === '0x' || entityId === '0x0') return '0';
  const hex = entityId.startsWith('0x') ? entityId.slice(2) : entityId;
  try {
    const value = BigInt(`0x${hex}`);
    if (value >= 0n && value < BigInt(256 ** 6)) return value.toString();
  } catch {
    // Non-hex identifiers use the same compact fingerprint as hash entities.
  }
  return hex.slice(0, 4).toUpperCase();
};
