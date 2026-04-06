import type { case_status, run_status } from '@prisma/client';

export type RunStatus = run_status;

export interface RunSummary {
  id: number;
  suite_id: number;
  suite_name: string;
  status: RunStatus;
  reason: string | null;
  exit_code: number | null;
  created_at: Date;
  start_time: Date | null;
  end_time: Date | null;
  duration_ms: number | null;
}

export interface RunResultSummary {
  total_count: number;
  passed_count: number;
  failed_count: number;
  skipped_count: number;
}

export interface RunDetail extends RunSummary {
  command: string;
  cwd: string;
  sut_base_url: string;
  probe_url: string;
  artifacts: RunArtifactPresence;
  result_summary: RunResultSummary | null;
}

export interface RunArtifactPresence {
  stdout_log: boolean;
  stderr_log: boolean;
  results_json: boolean;
  report_dir: boolean;
}

export interface CaseResultRow {
  test_lib_case_code: string;
  case_title: string;
  status: case_status;
  failed_at: Date | null;
  duration_ms: number | null;
}

export interface RunExecutionContext {
  id: number;
  suite_id: number;
  suite_name_snapshot: string;
  status: RunStatus;
  reason: string | null;
  exit_code: number | null;
  created_at: Date;
  start_time: Date | null;
  end_time: Date | null;
  duration_ms: number | null;
  command: string;
  cwd: string;
  sut_base_url: string;
  probe_url: string;
}
