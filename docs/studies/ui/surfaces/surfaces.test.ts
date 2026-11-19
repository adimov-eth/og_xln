import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import {
  DEFAULT_REPO_ROOT,
  DEFAULT_SCM_FILES,
  evaluateSources,
  renderTypeScriptModule,
  validateSpecFiles,
} from './check.ts';

const BASE_SOURCES = DEFAULT_SCM_FILES.map(path => ({
  name: path,
  code: readFileSync(path, 'utf8'),
}));

describe('xln Arrival Scheme UI surface & Program spec (DSL v3)', () => {
  test('validates base.scm, everyday.scm, personal.scm, pro.scm, programs.scm, forks.scm, and rounds/*.scm with zero errors', async () => {
    const res = await validateSpecFiles();
    expect(res.errors).toEqual([]);
    expect(res.legacyScreens).toHaveLength(16);
    expect(res.signingSheets.length).toBeGreaterThanOrEqual(6);
    expect(res.apps.length).toBeGreaterThanOrEqual(10);
    expect(res.surfaces.map(s => s.id)).toEqual(['everyday', 'personal', 'pro']);
    const everyday = res.surfaces.find(s => s.id === 'everyday')!;
    expect(everyday.posture).toBe('human-everyday');
    expect(everyday.autopilots.map(a => a.id)).toEqual([
      'auto-settle-incoming',
      'auto-route-funds',
      'auto-recovery-shield',
    ]);
  });

  test('enforces human-everyday compiler laws: rejects :bars, plumbing jargon, and manual plumbing buttons', async () => {
    const withBars = BASE_SOURCES.map(entry =>
      entry.name.endsWith('everyday.scm')
        ? {
            ...entry,
            code: entry.code.replace(
              ":figures   ['everyday-cash 'arriving-cash]",
              ":figures   ['everyday-cash 'arriving-cash]\n      :bars      ['everyday-cash]",
            ),
          }
        : entry,
    );
    const barsRes = await evaluateSources(withBars, DEFAULT_REPO_ROOT);
    expect(barsRes.errors.some(e => e.includes('everyday posture forbids channel/capacity :bars'))).toBe(true);

    const withJargon = BASE_SOURCES.map(entry =>
      entry.name.endsWith('everyday.scm')
        ? {
            ...entry,
            code: entry.code.replace(
              '"Your money, ready to spend or cash out anytime."',
              '"Backed by collateral in the depository."',
            ),
          }
        : entry,
    );
    const jargonRes = await evaluateSources(withJargon, DEFAULT_REPO_ROOT);
    expect(jargonRes.errors.some(e => e.includes("leaks protocol/plumbing jargon 'collateral'"))).toBe(true);

    const withPlumbingButton = BASE_SOURCES.map(entry =>
      entry.name.endsWith('everyday.scm')
        ? {
            ...entry,
            code: entry.code.replace(
              "(flow 'pay        :verb 'send-routed",
              "(flow 'manual-cov :verb 'request-cover   :before (guess \"Cover\") :pending (guess \"...\") :done (guess \"Done\") :failed (guess \"No\"))\n    (flow 'pay        :verb 'send-routed",
            ),
          }
        : entry,
    );
    const btnRes = await evaluateSources(withPlumbingButton, DEFAULT_REPO_ROOT);
    expect(btnRes.errors.some(e => e.includes("everyday posture forbids manual plumbing button 'request-cover'"))).toBe(
      true,
    );
  });

  test('preserves conditional term notes (BalanceDetails.tsx:33) and figure-to-term links', async () => {
    const res = await validateSpecFiles();
    const personal = res.surfaces.find(s => s.id === 'personal')!;
    expect(personal.terms.unbacked?.label.text).toBe('Without collateral');
    expect(personal.terms.unbacked?.note?.text).toBe('Repayment depends on the other party.');
    expect(personal.terms.unbacked?.noteWhen).toBe('non-zero');
    const unbackedFig = res.figures.find(f => f.id === 'unbacked-exposure')!;
    expect(unbackedFig.term).toBe('unbacked');
  });

  test('evaluates :when Scheme state predicates across the 4 canonical WalletView states', async () => {
    const res = await validateSpecFiles();
    const personal = res.surfaces.find(s => s.id === 'personal')!;
    const safety = personal.screens.find(sc => sc.id === 'safety')!;
    expect(safety.visibleIn).toEqual({
      empty: false,
      uncovered: false,
      partlyCovered: true,
      disputed: true,
    });
  });

  test('rejects (as-is "path" "text") when text is missing from that exact cited file', async () => {
    const mutated = BASE_SOURCES.map(entry =>
      entry.name.endsWith('personal.scm')
        ? {
            ...entry,
            code: entry.code.replace(
              '(as-is "ui/src/screens/AccountDetail.tsx" "Cover it")',
              '(as-is "ui/src/screens/Pay.tsx" "Cover it")',
            ),
          }
        : entry,
    );
    const res = await evaluateSources(mutated, DEFAULT_REPO_ROOT);
    expect(res.errors.some(e => e.includes('not found verbatim in ui/src/screens/Pay.tsx'))).toBe(true);
  });

  test('rejects :render generative xln-app attempting to own Kernel-only unilateral-exit verb', async () => {
    const mutated = [
      ...BASE_SOURCES,
      {
        name: 'bad-gen.scm',
        code: `
          (xln-app 'unsafe-gen-exit
            :kind 'embedded
            :render 'generative
            :audience (guess "User")
            :reads ['secured-receivable]
            :requests ['unilateral-exit]
            :claim-shown (guess "AI exit widget")
            :why (guess "Test guard")
            :sources ["todo.md"])
        `,
      },
    ];
    const res = await evaluateSources(mutated, DEFAULT_REPO_ROOT);
    expect(
      res.errors.some(e => e.includes(":render 'generative Program cannot own Kernel-only verb 'unilateral-exit'")),
    ).toBe(true);
  });

  test('rejects plausible-looking fake :source and :tx symbols against compiler AST', async () => {
    const mutated = [
      ...BASE_SOURCES,
      {
        name: 'extra.scm',
        code: `
          (figure 'fake-fig :term 'secured :meaning (guess "Fake") :source "TokenTotals.imaginaryField")
          (figure 'fake-everyday-fig :term 'cash :meaning (guess "Fake") :source "EverydayProjection.imaginaryField")
          (verb 'fake-verb :layer 'entity :tx "nonExistentEntityTx" :summary (guess "Fake"))
        `,
      },
    ];
    const res = await evaluateSources(mutated, DEFAULT_REPO_ROOT);
    expect(res.errors.some(e => e.includes("figure/fake-fig: :source 'TokenTotals.imaginaryField'"))).toBe(true);
    expect(res.errors.some(e => e.includes("figure/fake-everyday-fig: :source 'EverydayProjection.imaginaryField'"))).toBe(true);
    expect(res.errors.some(e => e.includes("verb/fake-verb: EntityTx 'nonExistentEntityTx'"))).toBe(true);
  });

  test('rejects forbidden glossary synonyms and unauthorized fork closure', async () => {
    const mutated = [
      ...BASE_SOURCES.map(entry =>
        entry.name.endsWith('personal.scm')
          ? { ...entry, code: entry.code.replace('(guess "Direct payment settled.")', '(guess "Channel receipt signed.")') }
          : entry,
      ),
      {
        name: 'bad-close.scm',
        code: `
          (fork 'f-unauthorized
            :status 'closed
            :decider 'person
            :question "Can model guesses close a person fork?"
            :affects ['personal/home]
            :options {:a "Option A"}
            :current 'a
            :why (guess "Testing guard")
            :sources ["todo.md"]
            :closed-by "model-round-2"
            :evidence (guess "Models agreed"))
        `,
      },
    ];
    const res = await evaluateSources(mutated, DEFAULT_REPO_ROOT);
    expect(res.errors.some(e => e.includes('forbidden glossary synonym'))).toBe(true);
    expect(res.errors.some(e => e.includes("decider 'person' cannot be closed with 'guess' evidence"))).toBe(true);
  });

  test('rejects unknown keyword arguments via Arrival strict kwargs + notes validation', async () => {
    await expect(
      evaluateSources(
        [
          ...BASE_SOURCES,
          { name: 'typo.scm', code: `(figure 'bad :term 'net :meaning (guess "x") :source "TokenTotals.net" :typo-kw "oops")` },
        ],
        DEFAULT_REPO_ROOT,
      ),
    ).rejects.toThrow();
  });

  test('emits backward-compatible SURFACES plus FIGURE_TERMS, SIGNING_SHEETS, and XLN_APPS', async () => {
    const res = await validateSpecFiles();
    const emitted = renderTypeScriptModule(res);
    expect(emitted).toContain('export const FIGURE_TERMS =');
    expect(emitted).toContain('export const SIGNING_SHEETS =');
    expect(emitted).toContain('export const XLN_APPS =');
    expect(emitted).toContain('"Repayment depends on the other party."');
    expect(emitted).not.toContain('@here.build/arrival');
  });

  test('everyday surface reflects EverydayProjection, request-link, bounded transit buffer, savings consent, and 0 ETH gas honesty', async () => {
    const res = await validateSpecFiles();
    expect(res.errors).toEqual([]);
    expect(res.figures.find(f => f.id === 'everyday-cash')?.source).toBe('EverydayProjection.cash');
    expect(res.figures.find(f => f.id === 'friends-tabs')?.source).toBe('EverydayProjection.friendTabs');
    expect(res.figures.find(f => f.id === 'arriving-cash')?.source).toBe('EverydayProjection.arriving');

    const inlineSheet = res.signingSheets.find(s => s.id === 'everyday-inline-action')!;
    expect(inlineSheet.covers).toContain('request-payment-link');

    const everyday = res.surfaces.find(s => s.id === 'everyday')!;
    expect(everyday.terms.arriving?.label.text).toBe('Arriving');
    expect(everyday.terms.savings?.note?.text).toContain('not protected like Cash');
    expect(everyday.defaults.some(d => d.id === 'bounded-hub-transit-buffer' && d.value === '$250 transit cap · $1 immediate auto-settle')).toBe(true);
    expect(everyday.defaults.some(d => d.id === 'zero-silent-tabs')).toBe(false);

    const home = everyday.screens.find(sc => sc.id === 'home')!;
    expect(home.figures).toContain('arriving-cash');
    expect(home.actions).toContain('request-link');
    expect(everyday.flows.find(fl => fl.id === 'request-link')?.verb).toBe('request-payment-link');
    expect(everyday.autopilots.find(ap => ap.id === 'auto-recovery-shield')?.fallback.text).toContain('0 ETH');

    const emitted = renderTypeScriptModule(res);
    expect(emitted).toContain('"arriving-cash": "arriving"');
    expect(emitted).toContain('"request-link"');
  });
});
