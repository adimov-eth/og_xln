import { expect, test } from 'bun:test';
import { buildTowerRequestUrl } from '../../../core/storage/recovery/discovery/tower-http';

test('packaged iOS recovery uses its fixed proxy path instead of an insecure direct request', () => {
  const result = new URL(buildTowerRequestUrl('http://127.0.0.1:9100', '/api/tower/restore', 'xln://localhost/index.html'));
  expect(result.protocol).toBe('xln:');
  expect(result.host).toBe('localhost');
  expect(result.pathname).toBe('/api/watchtower-proxy');
  expect(result.searchParams.get('target')).toBe('http://127.0.0.1:9100');
  expect(result.searchParams.get('path')).toBe('/api/tower/restore');
});

test('HTTPS browser recovery retains its same-origin proxy', () => {
  const result = new URL(buildTowerRequestUrl('http://localhost:9100', 'api/recovery/discover', 'https://wallet.example/ui/'));
  expect(result.origin).toBe('https://wallet.example');
  expect(result.pathname).toBe('/api/watchtower-proxy');
});

test('remote HTTPS towers and server callers retain their direct transport', () => {
  expect(buildTowerRequestUrl('https://tower.example', '/api/tower/restore', 'xln://localhost/'))
    .toBe('https://tower.example/api/tower/restore');
  expect(buildTowerRequestUrl('http://127.0.0.1:9100', '/api/tower/restore'))
    .toBe('http://127.0.0.1:9100/api/tower/restore');
});
