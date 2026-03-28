type BindPort = (port: number) => Promise<void>;

export interface BindBackendPortOptions {
  bindPort: BindPort;
  configuredPortValue: string | undefined;
  defaultPort?: number;
  shouldEnablePortFallback: boolean;
}

function parsePortValue(portValue: string): number {
  if (!/^\d+$/.test(portValue)) {
    throw new Error(`PORT must be a positive integer. Received: ${portValue}`);
  }

  const parsedPort = Number(portValue);

  if (!Number.isInteger(parsedPort) || parsedPort <= 0) {
    throw new Error(`PORT must be a positive integer. Received: ${portValue}`);
  }

  return parsedPort;
}

function isAddressInUseError(error: unknown): error is NodeJS.ErrnoException {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'EADDRINUSE'
  );
}

export async function bindBackendPort({
  bindPort,
  configuredPortValue,
  defaultPort = 3000,
  shouldEnablePortFallback,
}: BindBackendPortOptions): Promise<number> {
  if (configuredPortValue !== undefined) {
    const explicitPort = parsePortValue(configuredPortValue);
    await bindPort(explicitPort);
    return explicitPort;
  }

  if (!shouldEnablePortFallback) {
    await bindPort(defaultPort);
    return defaultPort;
  }

  let candidatePort = defaultPort;

  while (true) {
    try {
      await bindPort(candidatePort);
      return candidatePort;
    } catch (error) {
      if (!isAddressInUseError(error)) {
        throw error;
      }

      candidatePort += 1;
    }
  }
}
