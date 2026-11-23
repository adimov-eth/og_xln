import { expect, test } from 'bun:test';
import { createHoldPress, type HoldPressPhase } from '../../../frontend/src/lib/components/Entity/core/hold-press';

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const harness = () => {
  const phases: HoldPressPhase[] = [];
  let confirmed = 0;
  const press = createHoldPress({ holdMs: 30, armMs: 40, onChange: phase => phases.push(phase), onConfirm: () => { confirmed += 1; } });
  return { press, phases, confirmed: () => confirmed };
};

test('a pointer must hold for the full time; releasing early signs nothing', async () => {
  const h = harness();
  h.press.pointerDown();
  await wait(10);
  h.press.pointerRelease();
  await wait(40);
  expect(h.confirmed()).toBe(0);
  h.press.pointerDown();
  await wait(45);
  expect(h.confirmed()).toBe(1);
  expect(h.phases).toEqual(['holding', 'idle', 'holding', 'done']);
});

test('keyboard arms on the first activation and signs on the second', () => {
  const h = harness();
  h.press.activate(false);
  h.press.activate(false);
  expect(h.confirmed()).toBe(1);
  expect(h.phases).toEqual(['armed', 'done']);
});

test('key repeat never signs, and an armed press disarms after its timeout', async () => {
  const h = harness();
  h.press.activate(false);
  h.press.activate(true);
  h.press.activate(true);
  expect(h.confirmed()).toBe(0);
  await wait(55);
  expect(h.phases).toEqual(['armed', 'idle']);
  h.press.activate(false);
  h.press.dispose();
  expect(h.confirmed()).toBe(0);
});
