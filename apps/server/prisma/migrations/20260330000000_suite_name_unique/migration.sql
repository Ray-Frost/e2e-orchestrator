-- Replace the old non-unique suite_name index with a unique index.
DROP INDEX "suites_suite_name_idx";

CREATE UNIQUE INDEX "suites_suite_name_key" ON "suites"("suite_name");
