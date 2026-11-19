export const normalizeId = (value: unknown): string => String(value || '').trim().toLowerCase();

export const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));
