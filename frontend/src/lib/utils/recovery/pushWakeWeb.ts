import type { PushWakeDeviceToken } from './pushWakeTypes';
const vapidKeyBytes = (base64Url: string): ArrayBuffer => {
  const padding = '='.repeat((4 - base64Url.length % 4) % 4);
  const base64 = `${base64Url}${padding}`.replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  const buffer = new ArrayBuffer(raw.length);
  const bytes = new Uint8Array(buffer);
  for (let index = 0; index < raw.length; index += 1) bytes[index] = raw.charCodeAt(index);
  return buffer;
};

export const requestWebPushToken = async (publicKey: string, workerUrl: string): Promise<PushWakeDeviceToken | null> => {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return null;
  if (!publicKey) return null;
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    throw new Error('PUSH_WEB_PUSH_UNAVAILABLE');
  }
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('PUSH_WEB_PUSH_PERMISSION_DENIED');
  const registration = await navigator.serviceWorker.register(workerUrl);
  const existing = await registration.pushManager.getSubscription();
  const subscription = existing || await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: vapidKeyBytes(publicKey),
  });
  return {
    token: JSON.stringify(subscription.toJSON()),
    platform: 'web',
    source: 'web-push',
  };
};
