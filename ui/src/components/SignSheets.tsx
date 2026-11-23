import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { deriveDelta } from '@xln/core/account/utils';
import { withRuntimeCommittedRead } from '@xln/core/runtime/frame/lifecycle/writer-lock';
import type { EntityTx } from '@xln/core/types/entity-tx';
import { createHoldPress, type HoldPress, type HoldPressPhase } from '@xln/frontend/lib/components/Entity/core/hold-press';
import {
  batchCommitted,
  captureSignBaseline,
  signSheetSourceFromAccounts,
  type SignSheetBaseline,
  type SignSheetSource,
  type SignSheetView,
} from '@xln/frontend/lib/components/Entity/core/sign-sheet';
import {
  isStewardLink,
  readStewardAnswer,
  readStewardPin,
  recordStewardAnswer,
  stewardRefusalText,
  verifyStewardLink,
} from '@xln/frontend/lib/governance/steward-request';
import { stewardSheet } from '@xln/frontend/lib/governance/steward-sheet';
import { getAdapter, getEmbeddedEnv } from '../runtime/adapter';
import { useApp } from '../runtime/store';
import { sendEntityTxs } from '../runtime/tx';
import { useWallet } from '../runtime/views';
import './sign-sheets.css';

const storage = (): Storage | null => {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

type Phase =
  | { kind: 'open' }
  | { kind: 'sent'; baseline: SignSheetBaseline; txs: readonly EntityTx[]; text: string }
  | { kind: 'done'; text: string }
  | { kind: 'declined' };

/**
 * A steward's signed request, opened from a `#steward/…` link. The wallet verifies it against the
 * steward the person pinned, renders the facts, and on Sign sends the batch as the person's own
 * transaction. Nothing appears without a link; nothing is signed without the person's press.
 */
export function SignSheets() {
  const { hash, pathname, search } = useLocation();
  const navigate = useNavigate();
  const activeEntityId = useApp(s => s.activeEntityId);
  const height = useApp(s => s.height);
  const status = useApp(s => s.adapterStatus);
  const commandsReady = useApp(s => s.commandReady);
  const tokens = useApp(s => s.tokenCatalog);
  const wallet = useWallet(activeEntityId);
  const [link, setLink] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [source, setSource] = useState<SignSheetSource | null>(null);
  const [phase, setPhase] = useState<Phase>({ kind: 'open' });

  useEffect(() => {
    if (!isStewardLink(hash)) return;
    setLink(hash.replace(/^#/, ''));
    setPhase({ kind: 'open' });
    void navigate({ pathname, search, hash: '' }, { replace: true });
  }, [hash, pathname, search, navigate]);

  useEffect(() => getAdapter()?.onChange(() => setRevision(value => value + 1)), [status, activeEntityId]);

  useEffect(() => {
    const env = getEmbeddedEnv();
    const { entityId, signerId } = wallet;
    if (!link || !env || !entityId || !signerId) {
      setSource(null);
      return;
    }
    let cancelled = false;
    // Read committed state under the Runtime lease, as the consensus inspector does.
    void withRuntimeCommittedRead(env, () => {
      const replica = env.state.eReplicas.get(`${entityId}:${signerId}`);
      if (!replica) return null;
      // Snapshot the numbers now: the source must not read live state after the lease ends.
      const live = signSheetSourceFromAccounts(entityId, replica.state.accounts, {
        token: tokenId => {
          const token = tokens.find(item => item.tokenId === tokenId);
          return token ? { symbol: token.symbol, decimals: Number(token.decimals) } : null;
        },
        deriveDelta,
      });
      const counterparties = [...replica.state.accounts.keys()].map(key => key.toLowerCase());
      const tokenIds = [...new Set(tokens.map(token => Number(token.tokenId)).concat([1]))];
      const snapshot = new Map<string, { limit: bigint | null; capacity: bigint | null; offdelta: bigint | null }>();
      for (const counterparty of counterparties) {
        for (const tokenId of tokenIds) {
          snapshot.set(`${counterparty}:${tokenId}`, {
            limit: live.extendedCreditLimit(counterparty, tokenId),
            capacity: live.sendCapacity(counterparty, tokenId),
            offdelta: live.offdelta(counterparty, tokenId),
          });
        }
      }
      const at = (counterparty: string, tokenId: number) => snapshot.get(`${counterparty.toLowerCase()}:${tokenId}`);
      return {
        token: live.token,
        hasAccount: (counterparty: string) => counterparties.includes(counterparty.toLowerCase()),
        extendedCreditLimit: (counterparty: string, tokenId: number) => at(counterparty, tokenId)?.limit ?? null,
        sendCapacity: (counterparty: string, tokenId: number) => at(counterparty, tokenId)?.capacity ?? null,
        offdelta: (counterparty: string, tokenId: number) => at(counterparty, tokenId)?.offdelta ?? null,
      } satisfies SignSheetSource;
    }).then(next => {
      if (!cancelled) setSource(next);
    });
    return () => {
      cancelled = true;
    };
  }, [link, wallet.entityId, wallet.signerId, height, status, tokens, revision]);

  useEffect(() => {
    if (phase.kind === 'sent' && source && batchCommitted(phase.txs, phase.baseline, source)) {
      setPhase({ kind: 'done', text: phase.text });
    }
  }, [phase, source]);

  if (!link || !wallet.entityId) return null;
  const close = () => setLink(null);
  const pin = readStewardPin(storage(), wallet.entityId);
  const verified = verifyStewardLink(link, { entityId: wallet.entityId, pin, now: Date.now() });

  if (!verified.ok) {
    return (
      <section className="sign-outcome" data-testid="sign-sheet-refused" data-reason={verified.reason} role="alert">
        <span>{stewardRefusalText[verified.reason]}</span>
        <button type="button" className="btn ghost" onClick={close}>
          Close
        </button>
      </section>
    );
  }
  if (!pin || !source) return <p className="muted">Reading your committed state…</p>;

  const { sheet, txs } = stewardSheet(verified.request, pin, source, Date.now());
  const answered = readStewardAnswer(storage(), wallet.entityId, sheet.id);

  if (phase.kind === 'sent') {
    return (
      <section className="sign-outcome" data-testid="sign-sheet-outcome" data-state="sent" role="status">
        <span>Sent to your Entity. Waiting for the change to commit…</span>
      </section>
    );
  }
  if (phase.kind === 'done' || phase.kind === 'declined') {
    return (
      <section className="sign-outcome" data-testid="sign-sheet-outcome" data-state={phase.kind === 'done' ? 'signed' : 'declined'} role="status">
        <span>{phase.kind === 'done' ? phase.text : 'Declined. Nothing was signed. Your steward is not told; tell it if it should know.'}</span>
        <button type="button" className="btn ghost" onClick={close}>
          Done
        </button>
      </section>
    );
  }
  if (answered) {
    return (
      <section className="sign-outcome" data-testid="sign-sheet-answered" role="status">
        <span>
          You already {answered.choice === 'signed' ? 'signed' : 'declined'} this request on this device on {new Date(answered.at).toLocaleString()}.
        </span>
        <button type="button" className="btn ghost" onClick={close}>
          Close
        </button>
      </section>
    );
  }

  const answer = async (choice: 'yes' | 'no') => {
    const store = storage();
    if (choice === 'no') {
      if (store) recordStewardAnswer(store, wallet.entityId!, { nonce: sheet.id, choice: 'declined', at: Date.now() });
      setPhase({ kind: 'declined' });
      return;
    }
    if (!wallet.signerId) throw new Error('SIGN_SHEET_SIGNER_MISSING');
    const baseline = captureSignBaseline(txs, source);
    await sendEntityTxs(wallet.entityId!, wallet.signerId, txs as EntityTx[]);
    if (store) recordStewardAnswer(store, wallet.entityId!, { nonce: sheet.id, choice: 'signed', at: Date.now() });
    setPhase({ kind: 'sent', baseline, txs, text: committedText(sheet) });
  };

  return <SignSheet key={sheet.id} sheet={sheet} commandsReady={commandsReady} onAnswer={answer} />;
}

const committedText = (sheet: SignSheetView): string => {
  const [first] = sheet.facts;
  if (sheet.facts.length === 1 && first?.verb === 'Pay' && first.amount && first.party) {
    return `Signed and committed: paid ${first.amount} to ${first.party.fingerprint}. It clears when their wallet confirms.`;
  }
  if (sheet.facts.length === 1 && first?.amount && first.party) {
    return `Signed and committed: ${first.party.fingerprint} can now owe you up to ${first.amount}.`;
  }
  return `Signed and committed: all ${sheet.facts.length} changes are in your Entity's state.`;
};

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const query = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!query) return;
    const update = () => setReduced(query.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return reduced;
}

function SignSheet({
  sheet,
  commandsReady,
  onAnswer,
}: {
  sheet: SignSheetView;
  commandsReady: boolean;
  onAnswer: (choice: 'yes' | 'no') => Promise<void>;
}) {
  const [sending, setSending] = useState<'yes' | 'no' | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [phase, setPhase] = useState<HoldPressPhase>('idle');
  const [termsOpen, setTermsOpen] = useState(false);
  const reducedMotion = useReducedMotion();
  const sendingRef = useRef(false);

  const send = async (choice: 'yes' | 'no') => {
    if (sendingRef.current) return;
    sendingRef.current = true;
    setFailure(null);
    setSending(choice);
    try {
      await onAnswer(choice);
    } catch (error) {
      setFailure(error instanceof Error ? error.message : String(error));
      setPhase('idle');
    } finally {
      sendingRef.current = false;
      setSending(null);
    }
  };
  const sendRef = useRef(send);
  sendRef.current = send;

  const press = useRef<HoldPress | null>(null);
  useEffect(() => {
    press.current = createHoldPress({ onChange: setPhase, onConfirm: () => void sendRef.current('yes') });
    return () => press.current?.dispose();
  }, [sheet.id]);

  const showTerms = termsOpen || sheet.hold.reasons.includes('unmodelled');
  const primaryText =
    sending === 'yes'
      ? 'Signing…'
      : !sheet.hold.required
        ? sheet.primaryLabel
        : phase === 'armed'
          ? sheet.armedLabel
          : phase === 'holding' && reducedMotion
            ? 'Keep holding…'
            : sheet.primaryLabel;

  const onPrimaryClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (!sheet.hold.required) {
      void send('yes');
      return;
    }
    // A click with no pointer press behind it is keyboard or assistive technology.
    if (event.detail === 0) press.current?.activate(false);
  };
  const onPrimaryKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!sheet.hold.required || (event.key !== 'Enter' && event.key !== ' ')) return;
    event.preventDefault();
    press.current?.activate(event.repeat);
  };
  const release = () => press.current?.pointerRelease();

  return (
    <section className="sign-sheet" data-testid="sign-sheet" data-request-id={sheet.id} aria-label="A request for your signature">
      <header className="sign-from">
        <span className="sign-who">{sheet.requester}</span>
        <span>asks you to sign</span>
      </header>
      <p className="sign-origin">{sheet.origin}</p>

      {sheet.facts.map((fact, index) => (
        <div className="sign-fact" data-testid="sign-sheet-fact" key={index}>
          <span className="sign-verb">{fact.verb}</span>
          {fact.amount ? <span className="sign-amount">{fact.amount}</span> : null}
          {fact.party ? (
            <div className="sign-party">
              <span className="sign-key">
                {fact.preposition ? <span className="sign-to-word">{fact.preposition} </span> : null}
                {fact.party.fingerprint}
              </span>
              <span className="sign-rel">{fact.party.hasAccount ? 'An account you have' : 'Not one of your accounts'}</span>
            </div>
          ) : null}
        </div>
      ))}

      {sheet.rows.length > 0 || sheet.consequence ? (
        <div className="sign-effect">
          {sheet.rows.map(row => (
            <div className="sign-row" key={row.label}>
              <span className="k">{row.label}</span>
              <span className={`was${row.tone === 'risk' ? ' risk' : ''}`}>{row.was}</span>
              <span className="to">→</span>
              <span className={`now${row.tone === 'risk' ? ' risk' : ''}`}>{row.now}</span>
            </div>
          ))}
          {sheet.consequence ? <p className="sign-plain">{sheet.consequence}</p> : null}
        </div>
      ) : null}

      {sheet.notices.map(notice => (
        <p className="sign-line" key={notice}>
          <span aria-hidden="true">◆</span>
          <span>{notice}</span>
        </p>
      ))}

      {sheet.note ? (
        <div className="sign-note">
          <span className="sign-note-label">{sheet.requester}'s note · not part of what you sign</span>
          <p data-testid="sign-sheet-note">{sheet.note}</p>
        </div>
      ) : null}

      <button type="button" className="sign-exact" aria-expanded={showTerms} onClick={() => setTermsOpen(open => !open)}>
        {showTerms ? '▴' : '▾'} Exact terms
      </button>
      {showTerms ? (
        <dl className="sign-terms" data-testid="sign-sheet-terms">
          {sheet.terms.map(([term, value]) => (
            <div key={term}>
              <dt>{term}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {failure ? (
        <p className="sign-failure" role="alert">
          Could not send: {failure}
        </p>
      ) : null}
      {!commandsReady ? <p className="sign-hint">Your wallet is not ready to sign yet.</p> : null}
      {sheet.blocked ? (
        <p className="sign-line" data-testid="sign-sheet-blocked">
          <span aria-hidden="true">◆</span>
          <span>{sheet.blocked}</span>
        </p>
      ) : null}

      <div className={`sign-acts${sending === 'yes' ? ' alone' : ''}`}>
        {sending !== 'yes' ? (
          <button type="button" className="btn" data-testid="sign-sheet-decline" disabled={sending !== null} onClick={() => void send('no')}>
            Decline
          </button>
        ) : null}
        <button
          type="button"
          className={`btn primary sign-primary${phase === 'holding' ? ' holding' : ''}${reducedMotion ? ' still' : ''}`}
          data-testid="sign-sheet-sign"
          data-hold={sheet.hold.required ? 'required' : 'none'}
          aria-describedby={sheet.hold.hint ? 'sign-sheet-hint' : undefined}
          disabled={!commandsReady || sending !== null || sheet.blocked !== null}
          onClick={onPrimaryClick}
          onKeyDown={onPrimaryKeyDown}
          onPointerDown={() => {
            if (sheet.hold.required) press.current?.pointerDown();
          }}
          onPointerUp={release}
          onPointerLeave={release}
          onPointerCancel={release}
        >
          {sheet.hold.required ? <span className="sign-fill" aria-hidden="true" /> : null}
          <span className="sign-label">{primaryText}</span>
        </button>
      </div>
      {sheet.hold.hint ? (
        <p className="sign-hint" id="sign-sheet-hint">
          {sheet.hold.hint}
        </p>
      ) : null}
      <p className="sr-only" role="status">
        {phase === 'armed' ? `${sheet.armedLabel} within 5 seconds.` : ''}
      </p>
    </section>
  );
}
