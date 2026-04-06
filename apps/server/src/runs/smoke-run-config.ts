import { Injectable, OnModuleInit } from '@nestjs/common';

export interface SmokeRunConfig {
  suiteName: string;
  command: string;
  cwd: string;
  sutBaseUrl: string;
  probeUrl: string;
  timeoutMinutes: number;
  timeoutMs: number;
}

export interface SmokeSuiteSeed {
  suiteName: string;
  command: string;
}

const extraSmokeSuiteSeeds: SmokeSuiteSeed[] = [
  {
    suiteName: 'demo-smoke-30-second-case',
    command: 'npm run test:smoke:platform:with-30-second-case',
  },
  {
    suiteName: 'demo-smoke-with-failure',
    command: 'npm run test:smoke:platform:with-failure',
  },
];

function readTrimmedEnvValue(
  env: NodeJS.ProcessEnv,
  key: string,
): string | undefined {
  const rawValue = env[key];

  if (rawValue === undefined) {
    return undefined;
  }

  const trimmedValue = rawValue.trim();

  if (trimmedValue.length === 0) {
    return undefined;
  }

  return trimmedValue;
}

function readRequiredEnvValue(env: NodeJS.ProcessEnv, key: string): string {
  const value = readTrimmedEnvValue(env, key);

  if (value === undefined) {
    throw new Error(`${key} is required.`);
  }

  return value;
}

function readPositiveIntegerEnvValue(
  env: NodeJS.ProcessEnv,
  key: string,
  defaultValue: number,
): number {
  const rawValue = readTrimmedEnvValue(env, key);

  if (rawValue === undefined) {
    return defaultValue;
  }

  if (!/^(?:0|[1-9][0-9]*)$/.test(rawValue)) {
    throw new Error(`${key} must be a positive integer.`);
  }

  const parsedValue = Number(rawValue);

  if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
    throw new Error(`${key} must be a positive integer.`);
  }

  return parsedValue;
}

export function loadSmokeRunConfig(
  env: NodeJS.ProcessEnv = process.env,
): SmokeRunConfig {
  const suiteName = readTrimmedEnvValue(env, 'E2E_SMOKE_SUITE_NAME');
  const command = readTrimmedEnvValue(env, 'E2E_SMOKE_COMMAND');
  const cwd = readRequiredEnvValue(env, 'E2E_SMOKE_CWD');
  const sutBaseUrl =
    readTrimmedEnvValue(env, 'E2E_SMOKE_SUT_BASE_URL') ??
    'http://localhost:3000';
  const probeUrl =
    readTrimmedEnvValue(env, 'E2E_SMOKE_PROBE_URL') ?? `${sutBaseUrl}/`;
  const timeoutMinutes = readPositiveIntegerEnvValue(
    env,
    'E2E_SMOKE_TIMEOUT_MINUTES',
    10,
  );

  return {
    suiteName: suiteName ?? 'demo-smoke',
    command: command ?? 'npm run test:smoke:platform',
    cwd,
    sutBaseUrl,
    probeUrl,
    timeoutMinutes,
    timeoutMs: timeoutMinutes * 60 * 1000,
  };
}

export function buildConfiguredSmokeSuites(
  smokeRunConfig: SmokeRunConfig,
): SmokeSuiteSeed[] {
  const configuredSuites = [
    {
      suiteName: smokeRunConfig.suiteName,
      command: smokeRunConfig.command,
    },
    ...extraSmokeSuiteSeeds,
  ];
  const seenSuiteNames = new Set<string>();

  return configuredSuites.filter((configuredSuite) => {
    if (seenSuiteNames.has(configuredSuite.suiteName)) {
      return false;
    }

    seenSuiteNames.add(configuredSuite.suiteName);
    return true;
  });
}

@Injectable()
export class SmokeRunConfigService implements OnModuleInit {
  private smokeRunConfig: SmokeRunConfig | null = null;

  onModuleInit(): void {
    this.getConfig();
  }

  getConfig(): SmokeRunConfig {
    if (this.smokeRunConfig === null) {
      this.smokeRunConfig = loadSmokeRunConfig();
    }

    return this.smokeRunConfig;
  }
}
