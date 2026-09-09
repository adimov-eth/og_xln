/** Password-encrypted local backup. Plaintext and derived keys never enter storage. */
const PREFIX = 'xln-password-vault:';
const ITERATIONS = 600_000;
type PasswordVault = { version: 1; salt: string; iv: string; ciphertext: string };
const encode = (bytes: Uint8Array): string => btoa(String.fromCharCode(...bytes));
const decode = (value: string): Uint8Array<ArrayBuffer> => Uint8Array.from(atob(value), c => c.charCodeAt(0));
const identity = (id: string): string => id.trim().toLowerCase();
const aad = (id: string): Uint8Array<ArrayBuffer> => new TextEncoder().encode(`${PREFIX}${identity(id)}:1`);

const keyFor = async (password: string, salt: Uint8Array<ArrayBuffer>): Promise<CryptoKey> => {
  const bytes = new TextEncoder().encode(password);
  try {
    const material = await crypto.subtle.importKey('raw', bytes, 'PBKDF2', false, ['deriveKey']);
    return await crypto.subtle.deriveKey(
      { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITERATIONS },
      material,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt'],
    );
  } finally {
    bytes.fill(0);
  }
};

export const hasPasswordVault = (id: string): boolean => localStorage.getItem(PREFIX + identity(id)) !== null;

export async function encryptPasswordVault(id: string, seed: string, password: string): Promise<string> {
  // Existing BrainVault secrets follow their original policy; never require a replacement secret.
  if (!password.length) throw new Error('Password is required.');
  if (!seed.trim() || !identity(id)) throw new Error('Wallet is not unlocked.');
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await keyFor(password, salt);
  const plaintext = new TextEncoder().encode(seed);
  try {
    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: aad(id) }, key, plaintext);
    const record: PasswordVault = {
      version: 1,
      salt: encode(salt),
      iv: encode(iv),
      ciphertext: encode(new Uint8Array(ciphertext)),
    };
    return JSON.stringify(record);
  } finally {
    plaintext.fill(0);
  }
}

export async function decryptPasswordVault(id: string, raw: string, password: string): Promise<string> {
  const value: unknown = JSON.parse(raw);
  if (!value || typeof value !== 'object') throw new Error('Invalid encrypted wallet.');
  const record = value as Record<string, unknown>;
  if (
    Object.keys(record).sort().join(',') !== 'ciphertext,iv,salt,version' ||
    record['version'] !== 1 ||
    typeof record['salt'] !== 'string' ||
    typeof record['iv'] !== 'string' ||
    typeof record['ciphertext'] !== 'string'
  ) {
    throw new Error('Unsupported encrypted wallet format.');
  }
  const salt = decode(record['salt']),
    iv = decode(record['iv']),
    ciphertext = decode(record['ciphertext']);
  if (salt.length !== 16 || iv.length !== 12 || ciphertext.length < 17) throw new Error('Invalid encrypted wallet.');
  const key = await keyFor(password, salt);
  let plaintext: ArrayBuffer;
  try {
    plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv, additionalData: aad(id) }, key, ciphertext);
  } catch {
    throw new Error('Incorrect password or damaged wallet.');
  }
  const bytes = new Uint8Array(plaintext);
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } finally {
    bytes.fill(0);
  }
}

export async function savePasswordVault(id: string, seed: string, password: string): Promise<void> {
  localStorage.setItem(PREFIX + identity(id), await encryptPasswordVault(id, seed, password));
}
export async function unlockPasswordVault(id: string, password: string): Promise<string> {
  const raw = localStorage.getItem(PREFIX + identity(id));
  if (!raw) throw new Error('Restore this wallet once to set a local password.');
  return decryptPasswordVault(id, raw, password);
}

export const removePasswordVault = (id: string): void => localStorage.removeItem(PREFIX + identity(id));
