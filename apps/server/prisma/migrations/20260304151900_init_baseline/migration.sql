-- CreateTable
CREATE TABLE "suites" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "suite_name" TEXT NOT NULL,
    "command" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "runs" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "suite_id" INTEGER NOT NULL,
    "suite_name_snapshot" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reason" TEXT,
    "exit_code" INTEGER,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "start_time" DATETIME,
    "end_time" DATETIME,
    "duration_ms" INTEGER,
    "command" TEXT NOT NULL,
    "cwd" TEXT NOT NULL,
    "sut_base_url" TEXT NOT NULL,
    "probe_url" TEXT NOT NULL,
    CONSTRAINT "runs_suite_id_fkey" FOREIGN KEY ("suite_id") REFERENCES "suites" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "case_results" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "run_id" INTEGER NOT NULL,
    "test_lib_case_code" TEXT NOT NULL,
    "case_title" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "failed_at" DATETIME,
    "duration_ms" INTEGER,
    CONSTRAINT "case_results_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "runs" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "suites_suite_name_idx" ON "suites"("suite_name");

-- CreateIndex
CREATE INDEX "runs_suite_id_idx" ON "runs"("suite_id");

-- CreateIndex
CREATE INDEX "runs_created_at_idx" ON "runs"("created_at");

-- CreateIndex
CREATE INDEX "runs_status_idx" ON "runs"("status");

-- CreateIndex
CREATE INDEX "case_results_run_id_idx" ON "case_results"("run_id");

-- CreateIndex
CREATE INDEX "case_results_test_lib_case_code_status_failed_at_idx" ON "case_results"("test_lib_case_code", "status", "failed_at");

-- CreateIndex
CREATE INDEX "case_results_case_title_status_failed_at_idx" ON "case_results"("case_title", "status", "failed_at");
