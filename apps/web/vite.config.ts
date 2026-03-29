import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

interface DevServerPortRegistryEntry {
  port: number;
  pid: number;
  started_at: string;
}

interface ResolveBackendProxyTargetOptions {
  isProcessLive?: (processId: number) => boolean;
  readRegistryFile?: (registryFilePath: string) => string;
  registryFilePath?: string;
}

const DEFAULT_BACKEND_PROXY_TARGET = 'http://localhost:3000';
const CONFIG_DIRECTORY_PATH = path.dirname(fileURLToPath(import.meta.url));
const DEV_SERVER_PORT_REGISTRY_PATH = path.resolve(
  CONFIG_DIRECTORY_PATH,
  '../../.runtime/dev-server-port.json',
);

function readRegistryFileFromDisk(registryFilePath: string): string {
  return readFileSync(registryFilePath, 'utf8');
}

function isPermissionError(error: unknown): error is NodeJS.ErrnoException {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'EPERM'
  );
}

function isProcessRunning(processId: number): boolean {
  try {
    process.kill(processId, 0);
    return true;
  } catch (error) {
    if (isPermissionError(error)) {
      return true;
    }

    return false;
  }
}

function isDevServerPortRegistryEntry(
  value: unknown,
): value is DevServerPortRegistryEntry {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidateRegistryEntry = value as Partial<DevServerPortRegistryEntry>;
  const port = candidateRegistryEntry.port;
  const processId = candidateRegistryEntry.pid;
  const startedAt = candidateRegistryEntry.started_at;

  return (
    typeof port === 'number' &&
    Number.isInteger(port) &&
    port > 0 &&
    port <= 65535 &&
    typeof processId === 'number' &&
    Number.isInteger(processId) &&
    processId > 0 &&
    typeof startedAt === 'string'
  );
}

function readDevServerPortRegistry(
  registryFilePath: string,
  readRegistryFile: (registryFilePath: string) => string,
): DevServerPortRegistryEntry | undefined {
  try {
    const parsedRegistryEntry = JSON.parse(
      readRegistryFile(registryFilePath),
    ) as unknown;

    if (!isDevServerPortRegistryEntry(parsedRegistryEntry)) {
      return undefined;
    }

    return parsedRegistryEntry;
  } catch {
    return undefined;
  }
}

export function resolveBackendProxyTarget(
  options: ResolveBackendProxyTargetOptions = {},
): string {
  const isProcessLive = options.isProcessLive ?? isProcessRunning;
  const readRegistryFile = options.readRegistryFile ?? readRegistryFileFromDisk;
  const registryFilePath =
    options.registryFilePath ?? DEV_SERVER_PORT_REGISTRY_PATH;

  const registryEntry = readDevServerPortRegistry(
    registryFilePath,
    readRegistryFile,
  );

  if (registryEntry === undefined || !isProcessLive(registryEntry.pid)) {
    return DEFAULT_BACKEND_PROXY_TARGET;
  }

  return `http://localhost:${registryEntry.port}`;
}

export function createApiProxyConfig(target: string) {
  return {
    '/api': {
      target,
      changeOrigin: true,
    },
  };
}

const apiProxyConfig = createApiProxyConfig(resolveBackendProxyTarget());

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: apiProxyConfig,
  },
  preview: {
    proxy: apiProxyConfig,
  },
});
