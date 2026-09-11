/** One shared USD scale, rounded up so the limiting bar fits its measured width. */
export function niceUsdPerPx(maxUsd: number, trackPx: number): number {
  const raw = Math.max(1, maxUsd / trackPx);
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  for (const step of [1, 2, 5, 10]) {
    if (step * magnitude >= raw) return step * magnitude;
  }
  throw new Error('BAR_SCALE_INVALID');
}
