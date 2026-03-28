// @vitest-environment node

import { expect, test } from 'vitest';
import viteConfig, {
  createApiProxyConfig,
  resolveBackendProxyTarget,
} from '../vite.config.ts';

test('resolveBackendProxyTarget falls back to port 3000 when the registry file is missing', () => {
  const resolvedTarget = resolveBackendProxyTarget({
    readRegistryFile: () => {
      const missingFileError = new Error('Registry file not found') as Error & {
        code: string;
      };
      missingFileError.code = 'ENOENT';
      throw missingFileError;
    },
  });

  expect(resolvedTarget).toBe('http://localhost:3000');
});

test('resolveBackendProxyTarget uses the recorded port when the registry is valid and the pid is live', () => {
  const resolvedTarget = resolveBackendProxyTarget({
    isProcessLive: () => true,
    readRegistryFile: () =>
      JSON.stringify({
        port: 3001,
        pid: 12345,
        started_at: '2026-03-28T10:00:00.000Z',
      }),
  });

  expect(resolvedTarget).toBe('http://localhost:3001');
});

test('resolveBackendProxyTarget ignores malformed registry content', () => {
  const resolvedTarget = resolveBackendProxyTarget({
    readRegistryFile: () => '{"port":3001',
  });

  expect(resolvedTarget).toBe('http://localhost:3000');
});

test('resolveBackendProxyTarget ignores a stale registry whose pid is no longer live', () => {
  const resolvedTarget = resolveBackendProxyTarget({
    isProcessLive: () => false,
    readRegistryFile: () =>
      JSON.stringify({
        port: 3002,
        pid: 54321,
        started_at: '2026-03-28T10:01:00.000Z',
      }),
  });

  expect(resolvedTarget).toBe('http://localhost:3000');
});

test('dev and preview both use the same startup proxy target resolution logic', () => {
  const expectedApiProxyConfig = createApiProxyConfig(
    resolveBackendProxyTarget(),
  );

  expect(viteConfig.server?.proxy).toMatchObject(expectedApiProxyConfig);
  expect(viteConfig.preview?.proxy).toMatchObject(expectedApiProxyConfig);
});
