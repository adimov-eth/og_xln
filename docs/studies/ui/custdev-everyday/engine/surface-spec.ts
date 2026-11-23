import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateSpecFiles } from '../../surfaces/check.ts';
import type {
  LoadedSurfaceSpec,
  SpecMode,
  SurfaceAutopilotSpec,
  SurfaceFlowSpec,
  SurfaceScreenSpec,
  SurfaceTermSpec,
} from '../types.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const SNAPSHOT_PATH = join(HERE, '..', 'baseline-surface-snapshot.json');

interface SnapshotShape {
  everyday: {
    terms: Record<string, { label: { text: string }; note?: { text: string }; noteWhen: string }>;
    screens: Array<{
      id: string;
      purpose: { text: string };
      headline: string;
      figures: string[];
      actions: string[];
      maxWords: number;
    }>;
    flows: Array<{
      id: string;
      verb: string;
      before: { text: string };
      pending: { text: string };
      done: { text: string };
      failed: { text: string };
    }>;
    autopilots: Array<{
      id: string;
      verbs: string[];
      trigger: { text: string };
      behavior: { text: string };
      fallback: { text: string };
    }>;
    defaults: Array<{
      id: string;
      value: string;
      riskBearer: string;
      consent: { text: string };
    }>;
  };
  signingSheets: Array<{
    id: string;
    delivery: string;
    shows: string[];
    feeBefore: boolean;
    survival?: { text: string };
    warns: Array<{ text: string }>;
  }>;
  figures: Array<{ id: string; term: string; meaning: { text: string }; source: string }>;
}

const BASE_WALLET_ACTIONS = [
  'pay',
  'cash-out',
  'split-bill',
  'settle-up',
  'add-savings',
  'move-to-cash',
  'approve-request',
  'reject-request',
  'export-backup',
  'wait-settlement',
  'reload-wallet',
  'clear-test-data',
] as const;

function buildSpec(mode: SpecMode, raw: SnapshotShape): LoadedSurfaceSpec {
  const ev = raw.everyday;
  const terms: Record<string, SurfaceTermSpec> = Object.fromEntries(
    Object.entries(ev.terms).map(([k, v]) => [
      k,
      { text: v.label.text, note: v.note?.text ?? null, noteWhen: v.noteWhen },
    ]),
  );
  const screens: Record<string, SurfaceScreenSpec> = Object.fromEntries(
    ev.screens.map(sc => [
      sc.id,
      {
        id: sc.id,
        purpose: sc.purpose.text,
        headline: sc.headline,
        figures: sc.figures,
        actions: sc.actions,
        maxWords: sc.maxWords,
      },
    ]),
  );
  const flows: Record<string, SurfaceFlowSpec> = Object.fromEntries(
    ev.flows.map(fl => [
      fl.id,
      {
        id: fl.id,
        verb: fl.verb,
        before: fl.before.text,
        pending: fl.pending.text,
        done: fl.done.text,
        failed: fl.failed.text,
      },
    ]),
  );
  const autopilots: Record<string, SurfaceAutopilotSpec> = Object.fromEntries(
    ev.autopilots.map(ap => [
      ap.id,
      {
        id: ap.id,
        verbs: ap.verbs,
        trigger: ap.trigger.text,
        behavior: ap.behavior.text,
        recoveryNote: ap.fallback.text,
      },
    ]),
  );
  const defaults = ev.defaults.map(d => ({
    id: d.id,
    value: d.value,
    riskBearer: d.riskBearer,
    consent: d.consent.text,
  }));
  const figures = Object.fromEntries(
    raw.figures.map(f => [f.id, { id: f.id, term: f.term, meaning: f.meaning.text, source: f.source }]),
  );
  const inlineSheet = raw.signingSheets.find(s => s.id === 'everyday-inline-action');
  const extSheet = raw.signingSheets.find(s => s.id === 'external-request-sheet');
  if (!inlineSheet || !extSheet) throw new Error('Missing everyday signing sheets in spec');

  const supportedActions = new Set<string>(BASE_WALLET_ACTIONS);
  if ('request-link' in flows) supportedActions.add('request-link');

  return {
    mode,
    terms,
    screens,
    flows,
    autopilots,
    defaults,
    figures,
    sheets: {
      inline: {
        delivery: inlineSheet.delivery,
        shows: inlineSheet.shows,
        feeBefore: inlineSheet.feeBefore,
        warns: inlineSheet.warns.map(w => w.text),
      },
      external: {
        delivery: extSheet.delivery,
        shows: extSheet.shows,
        feeBefore: extSheet.feeBefore,
        survival: extSheet.survival?.text ?? null,
        warns: extSheet.warns.map(w => w.text),
      },
    },
    supportedActions,
  };
}

export async function loadSurfaceSpec(mode: SpecMode): Promise<LoadedSurfaceSpec> {
  if (mode === 'baseline') {
    const snap = JSON.parse(readFileSync(SNAPSHOT_PATH, 'utf8')) as SnapshotShape;
    return buildSpec('baseline', snap);
  }
  const res = await validateSpecFiles();
  if (res.errors.length > 0) {
    throw new Error(`Refined spec validation failed:\n${res.errors.join('\n')}`);
  }
  const everyday = res.surfaces.find(s => s.id === 'everyday');
  if (!everyday) throw new Error('Missing everyday surface in refined spec');
  const figIds = new Set(everyday.screens.flatMap(sc => [sc.headline, ...sc.figures]));
  const raw: SnapshotShape = {
    everyday: everyday as unknown as SnapshotShape['everyday'],
    signingSheets: res.signingSheets.filter(
      s => s.id === 'everyday-inline-action' || s.id === 'external-request-sheet',
    ) as unknown as SnapshotShape['signingSheets'],
    figures: res.figures.filter(f => figIds.has(f.id)) as unknown as SnapshotShape['figures'],
  };
  return buildSpec('refined', raw);
}
