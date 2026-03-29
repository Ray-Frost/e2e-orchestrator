import { bindBackendPort } from './dev-server-port';
import {
  type DevServerPortRegistryEntry,
  removeDevServerPortRegistryIfOwned,
  writeDevServerPortRegistry,
} from './dev-server-port-registry';

interface BackendApplication {
  getUrl(): Promise<string>;
  listen(port: number): Promise<void>;
}

interface StartBackendServerOptions {
  app: BackendApplication;
  configuredPortValue: string | undefined;
  isLocalDevPortRegistryEnabled: boolean;
  shouldEnablePortFallback: boolean;
  logInfo?: (message: string) => void;
  processId?: number;
  registerShutdownCleanup?: (
    cleanupCallback: () => Promise<void> | void,
  ) => void;
  startedAt?: string;
  writeRegistry?: (registryEntry: DevServerPortRegistryEntry) => Promise<void>;
}

export interface StartBackendServerResult {
  boundPort: number;
  boundUrl: string;
  registryEntry?: DevServerPortRegistryEntry;
}

const EXIT_CODE_BY_SIGNAL = {
  SIGINT: 130,
  SIGTERM: 143,
} as const;

export function registerProcessShutdownCleanup(
  cleanupCallback: () => Promise<void> | void,
): void {
  let hasCleanupStarted = false;

  const runCleanup = async () => {
    if (hasCleanupStarted) {
      return;
    }

    hasCleanupStarted = true;
    await cleanupCallback();
  };

  process.once('beforeExit', () => {
    void runCleanup();
  });

  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.once(signal, () => {
      void runCleanup().finally(() => {
        process.exit(EXIT_CODE_BY_SIGNAL[signal]);
      });
    });
  }
}

export async function startBackendServer({
  app,
  configuredPortValue,
  isLocalDevPortRegistryEnabled,
  shouldEnablePortFallback,
  logInfo = console.log,
  processId = process.pid,
  registerShutdownCleanup = registerProcessShutdownCleanup,
  startedAt = new Date().toISOString(),
  writeRegistry = writeDevServerPortRegistry,
}: StartBackendServerOptions): Promise<StartBackendServerResult> {
  const boundPort = await bindBackendPort({
    bindPort: (port) => app.listen(port),
    configuredPortValue,
    shouldEnablePortFallback,
  });
  const boundUrl = await app.getUrl();

  logInfo(`Backend listening at ${boundUrl}`);

  if (!isLocalDevPortRegistryEnabled) {
    return {
      boundPort,
      boundUrl,
    };
  }

  const registryEntry = {
    port: boundPort,
    pid: processId,
    started_at: startedAt,
  } satisfies DevServerPortRegistryEntry;

  await writeRegistry(registryEntry);
  registerShutdownCleanup(() =>
    removeDevServerPortRegistryIfOwned(registryEntry),
  );

  return {
    boundPort,
    boundUrl,
    registryEntry,
  };
}
