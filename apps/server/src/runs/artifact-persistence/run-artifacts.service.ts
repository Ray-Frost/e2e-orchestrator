import { Injectable, Logger } from '@nestjs/common';
import {
  access,
  FileHandle,
  mkdir,
  open,
  readdir,
  rm,
  rmdir,
  writeFile,
} from 'node:fs/promises';
import { RunArtifactPaths, resolveRunArtifactPaths } from './artifact-paths';
import {
  RunArtifactMetaSnapshotInput,
  buildRunArtifactMetaSnapshot,
} from './meta-snapshot';

const RUN_ARTIFACT_BOOTSTRAP_FAILURE_REASON = 'parse_or_write_error';

type RunArtifactsServiceInput = RunArtifactMetaSnapshotInput;

interface RunArtifactsMetaWriteWarning {
  event: 'run_artifacts_meta_write_failed';
  run_id: number;
  suite_id: number;
  meta_json_path: string;
  error: string;
}

export class RunArtifactBootstrapError extends Error {
  readonly name = 'RunArtifactBootstrapError';
  readonly reason = RUN_ARTIFACT_BOOTSTRAP_FAILURE_REASON;

  constructor(
    readonly runId: number,
    readonly suiteId: number,
    cause: unknown,
  ) {
    super(`Failed to prepare artifact bootstrap for run ${runId}.`, {
      cause,
    });
  }
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

@Injectable()
export class RunArtifactsService {
  private readonly logger = new Logger(RunArtifactsService.name);

  protected resolvePaths(runId: number): RunArtifactPaths {
    return resolveRunArtifactPaths(runId);
  }

  async prepareForSpawn(
    input: RunArtifactsServiceInput,
  ): Promise<RunArtifactPaths> {
    const paths = this.resolvePaths(input.runId);
    const [hasExistingRunRoot, hasExistingStdoutLog, hasExistingStderrLog] =
      await Promise.all([
        this.pathExists(paths.runRoot),
        this.pathExists(paths.stdoutLog),
        this.pathExists(paths.stderrLog),
      ]);
    const cleanupPlan: BootstrapCleanupPlan = {
      removeRunRoot: !hasExistingRunRoot,
      removeStdoutLog: !hasExistingStdoutLog,
      removeStderrLog: !hasExistingStderrLog,
    };

    try {
      await this.ensureRunDirectory(paths.runRoot);
      await this.ensureRequiredLogTargets(paths);
    } catch (error) {
      await this.cleanupFailedBootstrap(paths, cleanupPlan);
      throw new RunArtifactBootstrapError(input.runId, input.suiteId, error);
    }

    await this.writeMetaSnapshotBestEffort(paths.metaJson, input);

    return paths;
  }

  async writeTerminalSnapshot(
    input: RunArtifactsServiceInput,
  ): Promise<RunArtifactPaths> {
    const paths = this.resolvePaths(input.runId);
    await this.writeMetaSnapshotBestEffort(paths.metaJson, input);
    return paths;
  }

  protected async ensureRunDirectory(runRoot: string): Promise<void> {
    await mkdir(runRoot, { recursive: true });
  }

  protected async ensureAppendFileTarget(filePath: string): Promise<void> {
    const hasExistingFile = await this.pathExists(filePath);
    let handle: FileHandle | undefined;

    try {
      handle = await open(filePath, 'a');
      await handle.close();
    } catch (error) {
      if (!hasExistingFile) {
        await this.removePathIfExists(filePath);
      }

      throw error;
    }
  }

  private async ensureRequiredLogTargets(
    paths: RunArtifactPaths,
  ): Promise<void> {
    const appendResults = await Promise.allSettled([
      this.ensureAppendFileTarget(paths.stdoutLog),
      this.ensureAppendFileTarget(paths.stderrLog),
    ]);

    const firstRejectedResult = appendResults.find(
      (appendResult): appendResult is PromiseRejectedResult =>
        appendResult.status === 'rejected',
    );

    if (firstRejectedResult) {
      throw firstRejectedResult.reason;
    }
  }

  protected async writeMetaSnapshotFile(
    metaJsonPath: string,
    input: RunArtifactsServiceInput,
  ): Promise<void> {
    const snapshot = buildRunArtifactMetaSnapshot(input);
    await writeFile(
      metaJsonPath,
      `${JSON.stringify(snapshot, null, 2)}\n`,
      'utf8',
    );
  }

  protected warnMetaWriteFailure(entry: RunArtifactsMetaWriteWarning): void {
    this.logger.warn(JSON.stringify(entry));
  }

  private async writeMetaSnapshotBestEffort(
    metaJsonPath: string,
    input: RunArtifactsServiceInput,
  ): Promise<void> {
    try {
      await this.writeMetaSnapshotFile(metaJsonPath, input);
    } catch (error) {
      this.warnMetaWriteFailure({
        event: 'run_artifacts_meta_write_failed',
        run_id: input.runId,
        suite_id: input.suiteId,
        meta_json_path: metaJsonPath,
        error: toErrorMessage(error),
      });
    }
  }

  private async cleanupFailedBootstrap(
    paths: RunArtifactPaths,
    cleanupPlan: BootstrapCleanupPlan,
  ): Promise<void> {
    if (cleanupPlan.removeStdoutLog) {
      await this.removePathIfExists(paths.stdoutLog);
    }

    if (cleanupPlan.removeStderrLog) {
      await this.removePathIfExists(paths.stderrLog);
    }

    if (cleanupPlan.removeRunRoot) {
      await this.removeDirectoryIfEmpty(paths.runRoot);
    }
  }

  private async pathExists(targetPath: string): Promise<boolean> {
    try {
      await access(targetPath);
      return true;
    } catch {
      return false;
    }
  }

  private async removePathIfExists(targetPath: string): Promise<void> {
    try {
      await rm(targetPath, { force: true });
    } catch {
      // Best-effort cleanup only.
    }
  }

  private async removeDirectoryIfEmpty(runRoot: string): Promise<void> {
    try {
      const entries = await readdir(runRoot);

      if (entries.length === 0) {
        await rmdir(runRoot);
      }
    } catch {
      // Best-effort cleanup only.
    }
  }
}

interface BootstrapCleanupPlan {
  removeRunRoot: boolean;
  removeStdoutLog: boolean;
  removeStderrLog: boolean;
}
