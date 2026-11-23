#!/usr/bin/env bun

import { Glob } from 'bun';

import {
  formatQaTestCategoryViolations,
  inspectQaTestCategory,
} from '../../../qa/test-categories';
import { listPlaywrightTestMetadata } from '../../e2e/harness/playwright-test-metadata';

const listSpecs = (root: string): string[] =>
  [...new Glob(`${root}/**/*.spec.ts`).scanSync({ dot: true, onlyFiles: true })].sort();

const mainTests = await listPlaywrightTestMetadata(listSpecs('tests'));
const frontendTests = await listPlaywrightTestMetadata(listSpecs('frontend/tests'), {
  profile: 'brainvault',
  project: 'brainvault',
});
const walletTests = await listPlaywrightTestMetadata(listSpecs('ui/tests'), {
  cwd: 'ui',
  project: 'chromium',
});
const tests = [...mainTests, ...frontendTests, ...walletTests];
const violations = tests.flatMap((test) => {
  const violation = inspectQaTestCategory(test);
  return violation ? [violation] : [];
});

if (tests.length === 0) throw new Error('QA_E2E_CATEGORY_GATE_NO_TESTS');
if (violations.length > 0) {
  throw new Error(
    `QA_E2E_CATEGORY_GATE_FAILED:${violations.length}/${tests.length}\n${formatQaTestCategoryViolations(violations)}`,
  );
}

console.log(`QA_E2E_CATEGORY_GATE_OK tests=${tests.length} functional=${tests.filter(test => test.tags.includes('@functional')).length} resilience=${tests.filter(test => test.tags.includes('@resilience')).length}`);
