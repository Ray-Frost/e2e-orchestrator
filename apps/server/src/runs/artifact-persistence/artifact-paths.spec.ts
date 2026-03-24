import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import test from 'node:test';
import path from 'node:path';
import {
  ARTIFACTS_ROOT_PATH,
  resolveRunArtifactPaths,
} from './artifact-paths';

void test('ARTIFACTS_ROOT_PATH derives the repo-root artifacts directory', () => {
  assert.equal(
    ARTIFACTS_ROOT_PATH,
    path.resolve(__dirname, '../../../../../artifacts'),
  );
});

void test('resolveRunArtifactPaths does not depend on process.cwd()', async (testContext) => {
  const originalCwd = process.cwd();
  const sandboxRoot = await mkdtemp(path.join(os.tmpdir(), 'artifacts-root-'));

  testContext.after(async () => {
    process.chdir(originalCwd);
    await rm(sandboxRoot, { force: true, recursive: true });
  });

  process.chdir(sandboxRoot);

  assert.equal(resolveRunArtifactPaths(42).runRoot, path.join(ARTIFACTS_ROOT_PATH, 'run-42'));
});

void test('resolveRunArtifactPaths derives deterministic run paths', () => {
  const paths = resolveRunArtifactPaths(42);
  const runRoot = path.join(ARTIFACTS_ROOT_PATH, 'run-42');

  assert.deepEqual(paths, {
    runRoot,
    stdoutLog: path.join(runRoot, 'stdout.log'),
    stderrLog: path.join(runRoot, 'stderr.log'),
    resultsJson: path.join(runRoot, 'results.json'),
    reportDir: path.join(runRoot, 'playwright-report'),
    metaJson: path.join(runRoot, 'meta.json'),
    testResultsDir: path.join(runRoot, 'test-results'),
  });
});
