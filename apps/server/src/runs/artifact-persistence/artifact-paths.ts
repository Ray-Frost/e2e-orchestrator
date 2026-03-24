import path from 'node:path';

export const ARTIFACTS_ROOT_PATH = path.resolve(
  __dirname,
  '../../../../../artifacts',
);

export interface RunArtifactPaths {
  runRoot: string;
  stdoutLog: string;
  stderrLog: string;
  resultsJson: string;
  reportDir: string;
  metaJson: string;
  testResultsDir: string;
}

export function resolveRunArtifactPaths(runId: number): RunArtifactPaths {
  const runRoot = path.join(ARTIFACTS_ROOT_PATH, `run-${runId}`);

  return {
    runRoot,
    stdoutLog: path.join(runRoot, 'stdout.log'),
    stderrLog: path.join(runRoot, 'stderr.log'),
    resultsJson: path.join(runRoot, 'results.json'),
    reportDir: path.join(runRoot, 'playwright-report'),
    metaJson: path.join(runRoot, 'meta.json'),
    testResultsDir: path.join(runRoot, 'test-results'),
  };
}
