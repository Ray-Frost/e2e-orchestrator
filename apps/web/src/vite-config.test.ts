// @vitest-environment node

import { expect, test } from 'vitest';
import viteConfig from '../vite.config.ts';

const expectedApiProxyConfig = {
  '/api': {
    target: 'http://localhost:3000',
    changeOrigin: true,
  },
};

void test('proxies /api requests to the backend in both dev and preview', () => {
  expect(viteConfig.server?.proxy).toMatchObject(expectedApiProxyConfig);
  expect(viteConfig.preview?.proxy).toMatchObject(expectedApiProxyConfig);
});
