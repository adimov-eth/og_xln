import { verifyMessage, type Signer } from 'ethers';
import { decodeBase64Bytes, encodeBase64Bytes } from '@xln/core/protocol/serialization/base64';
import type { EntityTx } from '@xln/core/types/entity-tx';

/**
 * A steward's signed request: facts the person may sign, carried in a link.
 *
 * The steward is an Entity of its own; its signer signs the exact request text
 * (docs/clerk-boundary.md: a proposal that travels is "a typed object signed by an Entity
 * signer"). The person pins that steward in Settings, never from a link. The request names
 * facts, not transactions: the wallet builds the transaction from them with its own builders,
 * so nothing from the link is ever sent as it arrived. A pin is wallet-local; it vanishes on
 * reset and every request is then refused until the person pins again.
 */

export const STEWARD_REQUEST_DOMAIN = 'xln-steward-request';
export const STEWARD_REQUEST_VERSION = 1;
export const STEWARD_LINK_PREFIX = 'steward/';
const MAX_BODY_BYTES = 4096;
const MAX_FACTS = 4;
const MAX_NOTE_CHARS = 500;
const MAX_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;

export type StewardFact =
  | Readonly<{ kind: 'pay'; to: string; tokenId: number; amount: string }>
  | Readonly<{ kind: 'credit-limit'; counterparty: string; tokenId: number; amount: string }>;

export type StewardRequestBody = Readonly<{
  domain: typeof STEWARD_REQUEST_DOMAIN;
  v: typeof STEWARD_REQUEST_VERSION;
  /** The person's Entity the request is for. */
  entityId: string;
  /** The steward's own Entity and the signer that signs for it. */
  stewardEntityId: string;
  stewardSigner: string;
  nonce: string;
  createdAt: number;
  expiresAt: number;
  facts: readonly StewardFact[];
  note: string | null;
}>;

export type StewardPin = Readonly<{ stewardEntityId: string; stewardSigner: string; label: string; pinnedAt: number }>;

export type VerifiedStewardRequest = Readonly<{
  body: StewardRequestBody;
  /** The exact text the steward signed; also the request's identity for "already answered". */
  bodyText: string;
  signature: string;
}>;

export type StewardRequestRefusal =
  | 'malformed'
  | 'too-large'
  | 'no-pin'
  | 'wrong-signer'
  | 'bad-signature'
  | 'wrong-entity'
  | 'expired'
  | 'not-yet-valid'
  | 'unsupported-fact';

export const stewardRefusalText: Record<StewardRequestRefusal, string> = {
  malformed: 'This link is not a steward request this wallet can read. Nothing was signed.',
  'too-large': 'This request is larger than a steward request may be. Nothing was signed.',
  'no-pin': 'You have not pinned a steward for this Entity. Pin one in Settings first; nothing was signed.',
  'wrong-signer': 'This request was not signed by the steward you pinned. Nothing was signed.',
  'bad-signature': 'The signature on this request does not match its contents. Nothing was signed.',
  'wrong-entity': 'This request is for a different Entity than the one open. Nothing was signed.',
  expired: 'This request expired before you opened it. Nothing moved.',
  'not-yet-valid': 'This request claims a time in the future. Nothing was signed.',
  'unsupported-fact': 'This request asks for something a steward request cannot carry. Nothing was signed.',
};

const ENTITY_ID = /^0x[0-9a-f]{64}$/;
const ADDRESS = /^0x[0-9a-f]{40}$/;
const NONCE = /^[0-9a-f]{16,64}$/;
const AMOUNT = /^[1-9][0-9]{0,77}$/;

const utf8 = new TextEncoder();
const fromUtf8 = new TextDecoder('utf-8', { fatal: true });

const toBase64Url = (text: string): string =>
  encodeBase64Bytes(utf8.encode(text)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const fromBase64Url = (value: string): string => {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  return fromUtf8.decode(decodeBase64Bytes(base64 + '='.repeat((4 - (base64.length % 4)) % 4)));
};

const exactKeys = (value: object, keys: readonly string[]): boolean => {
  const own = Object.keys(value);
  return own.length === keys.length && keys.every(key => own.includes(key));
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const readFact = (value: unknown): StewardFact | null => {
  if (!isRecord(value)) return null;
  const tokenOk = Number.isSafeInteger(value['tokenId']) && Number(value['tokenId']) > 0;
  const amountOk = typeof value['amount'] === 'string' && AMOUNT.test(value['amount']);
  if (!tokenOk || !amountOk) return null;
  if (value['kind'] === 'pay' && exactKeys(value, ['kind', 'to', 'tokenId', 'amount'])) {
    return typeof value['to'] === 'string' && ENTITY_ID.test(value['to'])
      ? { kind: 'pay', to: value['to'], tokenId: Number(value['tokenId']), amount: value['amount'] as string }
      : null;
  }
  if (value['kind'] === 'credit-limit' && exactKeys(value, ['kind', 'counterparty', 'tokenId', 'amount'])) {
    return typeof value['counterparty'] === 'string' && ENTITY_ID.test(value['counterparty'])
      ? { kind: 'credit-limit', counterparty: value['counterparty'], tokenId: Number(value['tokenId']), amount: value['amount'] as string }
      : null;
  }
  return null;
};

type ParsedBody = { ok: true; body: StewardRequestBody } | { ok: false; reason: 'malformed' | 'unsupported-fact' };

/** Strict schema: every key known, every value in range. Plain JSON only; nothing is revived. */
const parseBody = (bodyText: string): ParsedBody => {
  let raw: unknown;
  try {
    raw = JSON.parse(bodyText);
  } catch {
    return { ok: false, reason: 'malformed' };
  }
  const keys = ['domain', 'v', 'entityId', 'stewardEntityId', 'stewardSigner', 'nonce', 'createdAt', 'expiresAt', 'facts', 'note'];
  if (!isRecord(raw) || !exactKeys(raw, keys)) return { ok: false, reason: 'malformed' };
  if (raw['domain'] !== STEWARD_REQUEST_DOMAIN || raw['v'] !== STEWARD_REQUEST_VERSION) return { ok: false, reason: 'malformed' };
  const text = (key: string, pattern: RegExp): string | null =>
    typeof raw[key] === 'string' && pattern.test(raw[key] as string) ? (raw[key] as string) : null;
  const entityId = text('entityId', ENTITY_ID);
  const stewardEntityId = text('stewardEntityId', ENTITY_ID);
  const stewardSigner = text('stewardSigner', ADDRESS);
  const nonce = text('nonce', NONCE);
  const createdAt = raw['createdAt'];
  const expiresAt = raw['expiresAt'];
  const note = raw['note'];
  if (!entityId || !stewardEntityId || !stewardSigner || !nonce) return { ok: false, reason: 'malformed' };
  if (!Number.isSafeInteger(createdAt) || !Number.isSafeInteger(expiresAt)) return { ok: false, reason: 'malformed' };
  if ((expiresAt as number) <= (createdAt as number) || (expiresAt as number) - (createdAt as number) > MAX_LIFETIME_MS) {
    return { ok: false, reason: 'malformed' };
  }
  if (note !== null && (typeof note !== 'string' || note.length > MAX_NOTE_CHARS)) return { ok: false, reason: 'malformed' };
  if (!Array.isArray(raw['facts']) || raw['facts'].length === 0 || raw['facts'].length > MAX_FACTS) return { ok: false, reason: 'malformed' };
  const facts = raw['facts'].map(readFact);
  if (facts.some(fact => fact === null)) return { ok: false, reason: 'unsupported-fact' };
  return {
    ok: true,
    body: {
      domain: STEWARD_REQUEST_DOMAIN,
      v: STEWARD_REQUEST_VERSION,
      entityId,
      stewardEntityId,
      stewardSigner,
      nonce,
      createdAt: createdAt as number,
      expiresAt: expiresAt as number,
      facts: facts as StewardFact[],
      note: note as string | null,
    },
  };
};

/** The link fragment after `#`: `steward/<body>.<signature>`, both base64url. */
export const encodeStewardLink = (bodyText: string, signature: string): string =>
  `${STEWARD_LINK_PREFIX}${toBase64Url(bodyText)}.${signature}`;

export const isStewardLink = (fragment: string): boolean => fragment.replace(/^#/, '').startsWith(STEWARD_LINK_PREFIX);

/** The steward's side: canonical body text, then an EIP-191 signature over exactly that text. */
export const signStewardRequest = async (body: StewardRequestBody, signer: Signer): Promise<string> => {
  const bodyText = JSON.stringify(body);
  return encodeStewardLink(bodyText, await signer.signMessage(bodyText));
};

/**
 * Verify before reading: size, signature over the exact received text against the pinned
 * signer, then the strict schema, then the Entity and time window.
 */
export const verifyStewardLink = (
  fragment: string,
  context: Readonly<{ entityId: string; pin: StewardPin | null; now: number }>,
): Readonly<{ ok: true; request: VerifiedStewardRequest } | { ok: false; reason: StewardRequestRefusal }> => {
  const value = fragment.replace(/^#/, '');
  if (!value.startsWith(STEWARD_LINK_PREFIX)) return { ok: false, reason: 'malformed' };
  const [encodedBody, signature, extra] = value.slice(STEWARD_LINK_PREFIX.length).split('.');
  if (!encodedBody || !signature || extra !== undefined || !/^0x[0-9a-fA-F]{130}$/.test(signature)) return { ok: false, reason: 'malformed' };
  if (encodedBody.length > Math.ceil((MAX_BODY_BYTES * 4) / 3) + 4) return { ok: false, reason: 'too-large' };
  let bodyText: string;
  try {
    bodyText = fromBase64Url(encodedBody);
  } catch {
    return { ok: false, reason: 'malformed' };
  }
  if (utf8.encode(bodyText).length > MAX_BODY_BYTES) return { ok: false, reason: 'too-large' };
  if (!context.pin) return { ok: false, reason: 'no-pin' };
  let recovered: string;
  try {
    recovered = verifyMessage(bodyText, signature).toLowerCase();
  } catch {
    return { ok: false, reason: 'bad-signature' };
  }
  if (recovered !== context.pin.stewardSigner.toLowerCase()) return { ok: false, reason: 'wrong-signer' };
  const parsed = parseBody(bodyText);
  if (!parsed.ok) return parsed;
  const { body } = parsed;
  if (body.stewardSigner !== recovered || body.stewardEntityId !== context.pin.stewardEntityId.toLowerCase()) {
    return { ok: false, reason: 'wrong-signer' };
  }
  if (body.entityId !== context.entityId.trim().toLowerCase()) return { ok: false, reason: 'wrong-entity' };
  if (body.createdAt > context.now + 5 * 60 * 1000) return { ok: false, reason: 'not-yet-valid' };
  if (body.expiresAt <= context.now) return { ok: false, reason: 'expired' };
  return { ok: true, request: { body, bodyText, signature } };
};

/**
 * The one batch the sheet shows and the wallet sends, built by the wallet from the facts. A
 * payment leaves directly through the Account with its recipient.
 */
export const buildStewardTxs = (body: StewardRequestBody): EntityTx[] =>
  body.facts.map((fact): EntityTx =>
    fact.kind === 'pay'
      ? {
          type: 'directPayment',
          data: {
            targetEntityId: fact.to,
            tokenId: fact.tokenId,
            amount: BigInt(fact.amount),
            route: [body.entityId, fact.to],
            deliveryMode: 'direct',
          },
        }
      : { type: 'extendCredit', data: { counterpartyEntityId: fact.counterparty, tokenId: fact.tokenId, amount: BigInt(fact.amount) } },
  );

type KeyValueStore = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

const pinKey = (entityId: string) => `xln-steward-pin:${entityId.trim().toLowerCase()}`;
const answeredKey = (entityId: string) => `xln-steward-answered:${entityId.trim().toLowerCase()}`;

/** Storage failures read as "no pin": a lost pin refuses requests, it never admits one. */
export const readStewardPin = (store: KeyValueStore | null, entityId: string): StewardPin | null => {
  try {
    const raw = store?.getItem(pinKey(entityId));
    if (!raw) return null;
    const value: unknown = JSON.parse(raw);
    if (!isRecord(value)) return null;
    const stewardEntityId = String(value['stewardEntityId'] ?? '').toLowerCase();
    const stewardSigner = String(value['stewardSigner'] ?? '').toLowerCase();
    if (!ENTITY_ID.test(stewardEntityId) || !ADDRESS.test(stewardSigner)) return null;
    return {
      stewardEntityId,
      stewardSigner,
      label: typeof value['label'] === 'string' ? value['label'].slice(0, 40) : '',
      pinnedAt: Number(value['pinnedAt'] ?? 0),
    };
  } catch {
    return null;
  }
};

export const writeStewardPin = (store: KeyValueStore, entityId: string, pin: StewardPin | null): void => {
  if (!pin) {
    store.removeItem(pinKey(entityId));
    return;
  }
  const stewardEntityId = pin.stewardEntityId.trim().toLowerCase();
  const stewardSigner = pin.stewardSigner.trim().toLowerCase();
  if (!ENTITY_ID.test(stewardEntityId)) throw new Error('STEWARD_PIN_ENTITY_INVALID');
  if (!ADDRESS.test(stewardSigner)) throw new Error('STEWARD_PIN_SIGNER_INVALID');
  store.setItem(pinKey(entityId), JSON.stringify({ stewardEntityId, stewardSigner, label: pin.label.trim().slice(0, 40), pinnedAt: pin.pinnedAt }));
};

export type StewardAnswer = Readonly<{ nonce: string; choice: 'signed' | 'declined'; at: number }>;

/** This wallet's own record of what it answered. Wallet-local: it is a courtesy, not replay protection. */
export const readStewardAnswer = (store: KeyValueStore | null, entityId: string, nonce: string): StewardAnswer | null => {
  try {
    const raw = store?.getItem(answeredKey(entityId));
    const list: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(list)) return null;
    const found = list.find(item => isRecord(item) && item['nonce'] === nonce);
    return found && (found.choice === 'signed' || found.choice === 'declined') ? (found as StewardAnswer) : null;
  } catch {
    return null;
  }
};

export const recordStewardAnswer = (store: KeyValueStore, entityId: string, answer: StewardAnswer): void => {
  let list: unknown[] = [];
  try {
    const raw = store.getItem(answeredKey(entityId));
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (Array.isArray(parsed)) list = parsed;
  } catch {
    list = [];
  }
  store.setItem(answeredKey(entityId), JSON.stringify([...list.slice(-199), answer]));
};
