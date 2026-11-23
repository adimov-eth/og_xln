import { afterEach, describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

import { panelBridge } from '../../../frontend/src/lib/view/utils/panelBridge';

afterEach(() => {
  panelBridge.clear();
});

describe('panel bridge diagnostics', () => {
  test('does not hide listener failures behind raw console output', () => {
    const source = readFileSync('frontend/src/lib/view/utils/panelBridge.ts', 'utf8');

    expect(source).not.toContain('console.error');
    expect(source).not.toContain('console.warn');
    expect(source).toContain('PANEL_BRIDGE_HANDLER_FAILED');
  });

  test('notifies remaining listeners and then fails loud when a listener throws', () => {
    let delivered = false;
    panelBridge.on('settings:reset', () => {
      throw new Error('listener exploded');
    });
    panelBridge.on('settings:reset', () => {
      delivered = true;
    });

    expect(() => panelBridge.emit('settings:reset', {})).toThrow(
      'PANEL_BRIDGE_HANDLER_FAILED:settings:reset:listener exploded',
    );
    expect(delivered).toBe(true);
  });
});
