/** Recovery routing is application configuration, never a wallet onboarding field. */
export function nativeRecoveryUrl(apiBase: string, configured?: string): string {
  const network = new URL(apiBase);
  const loopback = ['localhost', '127.0.0.1', '[::1]'];
  const local = network.protocol === 'http:' && loopback.includes(network.hostname);
  const url = new URL(configured?.trim() || (local ? 'http://127.0.0.1:9100' : 'https://xln.finance'));
  if (url.username || url.password || url.search || url.hash ||
      (url.protocol !== 'https:' && !(local && url.protocol === 'http:' && loopback.includes(url.hostname)))) {
    throw new Error('IOS_RECOVERY_ORIGIN_INVALID');
  }
  return url.href.replace(/\/+$/, '');
}
