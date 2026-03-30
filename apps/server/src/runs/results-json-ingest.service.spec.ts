import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import type { PrismaService } from '../prisma/prisma.service';
import {
  parsePlaywrightResultsJson,
  ResultsJsonIngestService,
} from './results-json-ingest.service';

function buildReferenceResultsJson() {
  return JSON.stringify({
    suites: [
      {
        title: 'smoke.spec.ts',
        specs: [
          {
            title: 'passes from test annotations',
            tests: [
              {
                annotations: [
                  {
                    type: 'test_lib_case_code',
                    description: 'AUTH_LOGIN_SUCCESS_ADD_ASSET',
                  },
                ],
                results: [
                  {
                    status: 'passed',
                    duration: 100,
                    startTime: '2026-03-29T15:51:53.224Z',
                    annotations: [],
                  },
                ],
              },
            ],
          },
          {
            title: 'falls back to final result annotations',
            tests: [
              {
                annotations: [],
                results: [
                  {
                    status: 'failed',
                    duration: 250,
                    startTime: '2026-03-29T15:52:53.224Z',
                    annotations: [
                      {
                        type: 'test_lib_case_code',
                        description: 'AUTH_LOGIN_INVALID_PASSWORD',
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  });
}

void test('parsePlaywrightResultsJson extracts one row per test and maps outcomes', () => {
  const parsedResults = parsePlaywrightResultsJson(buildReferenceResultsJson());

  assert.deepEqual(parsedResults, [
    {
      test_lib_case_code: 'AUTH_LOGIN_SUCCESS_ADD_ASSET',
      case_title: 'passes from test annotations',
      status: 'pass',
      failed_at: null,
      duration_ms: 100,
    },
    {
      test_lib_case_code: 'AUTH_LOGIN_INVALID_PASSWORD',
      case_title: 'falls back to final result annotations',
      status: 'fail',
      failed_at: new Date('2026-03-29T15:52:53.474Z'),
      duration_ms: 250,
    },
  ]);
});

void test('parsePlaywrightResultsJson parses the attached demo-test-lib results.json shape', async () => {
  const realResultsJsonPath = path.resolve(
    __dirname,
    '../../../../../demo-test-lib/results.json',
  );
  const realResultsJson = await readFile(realResultsJsonPath, 'utf8');

  assert.deepEqual(parsePlaywrightResultsJson(realResultsJson), [
    {
      test_lib_case_code: 'AUTH_LOGIN_SUCCESS_ADD_ASSET',
      case_title: 'User logs in successfully and clicks Add Asset',
      status: 'pass',
      failed_at: null,
      duration_ms: 1532,
    },
  ]);
});

void test('parsePlaywrightResultsJson rejects tests that are missing test_lib_case_code', () => {
  const invalidResultsJson = JSON.stringify({
    suites: [
      {
        specs: [
          {
            title: 'missing case code',
            tests: [
              {
                annotations: [],
                results: [
                  {
                    status: 'passed',
                    duration: 10,
                    startTime: '2026-03-29T15:51:53.224Z',
                    annotations: [],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  });

  assert.throws(
    () => parsePlaywrightResultsJson(invalidResultsJson),
    /missing test_lib_case_code/i,
  );
});

void test('parsePlaywrightResultsJson rejects tests with no results array', () => {
  const invalidResultsJson = JSON.stringify({
    suites: [
      {
        specs: [
          {
            title: 'missing results',
            tests: [
              {
                annotations: [
                  {
                    type: 'test_lib_case_code',
                    description: 'AUTH_LOGIN_SUCCESS_ADD_ASSET',
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  });

  assert.throws(
    () => parsePlaywrightResultsJson(invalidResultsJson),
    /missing results/i,
  );
});

function buildTwoCaseResultsJson() {
  return JSON.stringify({
    suites: [
      {
        specs: [
          {
            title: 'first case',
            tests: [
              {
                annotations: [
                  {
                    type: 'test_lib_case_code',
                    description: 'CASE_ONE',
                  },
                ],
                results: [
                  {
                    status: 'passed',
                    duration: 10,
                    startTime: '2026-03-29T15:51:53.224Z',
                    annotations: [],
                  },
                ],
              },
            ],
          },
          {
            title: 'second case',
            tests: [
              {
                annotations: [
                  {
                    type: 'test_lib_case_code',
                    description: 'CASE_TWO',
                  },
                ],
                results: [
                  {
                    status: 'failed',
                    duration: 15,
                    startTime: '2026-03-29T15:52:53.224Z',
                    annotations: [],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  });
}

void test('ResultsJsonIngestService keeps case-result writes atomic when a later DB write fails', async () => {
  const committedRows: Array<{
    run_id: number;
    test_lib_case_code: string;
  }> = [];
  let createCallCount = 0;

  const prismaService = {
    $transaction: async (
      callback: (transactionPrisma: {
        caseResult: {
          create: (input: {
            data: {
              run_id: number;
              test_lib_case_code: string;
            };
          }) => Promise<void>;
        };
      }) => Promise<void>,
    ) => {
      const stagedRows: typeof committedRows = [];

      await callback({
        caseResult: {
          create: ({ data }) => {
            createCallCount += 1;

            if (createCallCount === 2) {
              throw new Error('case_results write failed');
            }

            stagedRows.push(data);
            return Promise.resolve();
          },
        },
      });

      committedRows.push(...stagedRows);
    },
  } as unknown as PrismaService;

  const resultsJsonIngestService = new ResultsJsonIngestService(prismaService);

  await assert.rejects(
    () =>
      resultsJsonIngestService.ingestCaseResultsForRun(
        123,
        buildTwoCaseResultsJson(),
      ),
    /case_results write failed/,
  );
  assert.deepEqual(committedRows, []);
});
