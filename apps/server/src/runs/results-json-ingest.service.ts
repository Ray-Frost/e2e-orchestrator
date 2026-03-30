import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type ParsedPlaywrightCaseStatus = 'pass' | 'fail' | 'skip';

export interface ParsedPlaywrightCaseResult {
  test_lib_case_code: string;
  case_title: string;
  status: ParsedPlaywrightCaseStatus;
  failed_at: Date | null;
  duration_ms: number | null;
}

interface PlaywrightAnnotation {
  type?: string;
  description?: string;
}

interface PlaywrightTestResultEntry {
  status?: string;
  duration?: number;
  startTime?: string;
  annotations?: PlaywrightAnnotation[];
}

interface PlaywrightTestEntry {
  annotations?: PlaywrightAnnotation[];
  results?: PlaywrightTestResultEntry[];
}

interface PlaywrightSpecEntry {
  title?: string;
  tests?: PlaywrightTestEntry[];
}

interface PlaywrightSuiteEntry {
  specs?: PlaywrightSpecEntry[];
}

interface PlaywrightResultsJson {
  suites?: PlaywrightSuiteEntry[];
}

function parseResultsJsonValue(resultsJson: string): PlaywrightResultsJson {
  try {
    return JSON.parse(resultsJson) as PlaywrightResultsJson;
  } catch (error) {
    throw new Error('Malformed results.json content.', { cause: error });
  }
}

function getCaseCodeFromAnnotations(
  annotations: PlaywrightAnnotation[] | undefined,
): string | undefined {
  if (!Array.isArray(annotations)) {
    return undefined;
  }

  const caseCodeAnnotation = annotations.find(
    (annotation) => annotation.type === 'test_lib_case_code',
  );

  if (caseCodeAnnotation === undefined) {
    return undefined;
  }

  const caseCode = caseCodeAnnotation.description?.trim();

  if (caseCode === undefined || caseCode.length === 0) {
    return undefined;
  }

  return caseCode;
}

function getCaseCode(
  testEntry: PlaywrightTestEntry,
  finalResultEntry: PlaywrightTestResultEntry,
  caseTitle: string,
): string {
  const caseCodeFromTestAnnotations = getCaseCodeFromAnnotations(
    testEntry.annotations,
  );

  if (caseCodeFromTestAnnotations !== undefined) {
    return caseCodeFromTestAnnotations;
  }

  const caseCodeFromFinalResult = getCaseCodeFromAnnotations(
    finalResultEntry.annotations,
  );

  if (caseCodeFromFinalResult !== undefined) {
    return caseCodeFromFinalResult;
  }

  throw new Error(`Test "${caseTitle}" is missing test_lib_case_code.`);
}

function mapCaseStatus(finalResultStatus: string): ParsedPlaywrightCaseStatus {
  switch (finalResultStatus) {
    case 'passed':
      return 'pass';
    case 'skipped':
      return 'skip';
    case 'failed':
    case 'timedOut':
    case 'interrupted':
      return 'fail';
    default:
      throw new Error(`Unknown final test status: ${finalResultStatus}`);
  }
}

function parseFailedAt(
  finalResultEntry: PlaywrightTestResultEntry,
  caseTitle: string,
): Date {
  if (typeof finalResultEntry.startTime !== 'string') {
    throw new Error(`Failed test "${caseTitle}" is missing startTime.`);
  }

  if (
    typeof finalResultEntry.duration !== 'number' ||
    !Number.isFinite(finalResultEntry.duration)
  ) {
    throw new Error(`Failed test "${caseTitle}" is missing duration.`);
  }

  const startTimeValue = new Date(finalResultEntry.startTime).valueOf();

  if (Number.isNaN(startTimeValue)) {
    throw new Error(`Failed test "${caseTitle}" has an invalid startTime.`);
  }

  return new Date(startTimeValue + finalResultEntry.duration);
}

function parseTestResultEntry(
  testEntry: PlaywrightTestEntry,
  caseTitle: string,
): ParsedPlaywrightCaseResult {
  if (!Array.isArray(testEntry.results) || testEntry.results.length === 0) {
    throw new Error(`Test "${caseTitle}" is missing results[].`);
  }

  const finalResultEntry = testEntry.results[testEntry.results.length - 1];

  if (finalResultEntry === undefined || finalResultEntry.status === undefined) {
    throw new Error(`Test "${caseTitle}" has an invalid final result entry.`);
  }

  const status = mapCaseStatus(finalResultEntry.status);
  const testLibCaseCode = getCaseCode(testEntry, finalResultEntry, caseTitle);

  return {
    test_lib_case_code: testLibCaseCode,
    case_title: caseTitle,
    status,
    failed_at:
      status === 'fail' ? parseFailedAt(finalResultEntry, caseTitle) : null,
    duration_ms:
      typeof finalResultEntry.duration === 'number' &&
      Number.isFinite(finalResultEntry.duration)
        ? finalResultEntry.duration
        : null,
  };
}

export function parsePlaywrightResultsJson(
  resultsJson: string,
): ParsedPlaywrightCaseResult[] {
  const parsedResultsJson = parseResultsJsonValue(resultsJson);
  const parsedCaseResults: ParsedPlaywrightCaseResult[] = [];

  if (!Array.isArray(parsedResultsJson.suites)) {
    throw new Error('results.json is missing suites[].');
  }

  for (const suiteEntry of parsedResultsJson.suites) {
    if (!Array.isArray(suiteEntry.specs)) {
      continue;
    }

    for (const specEntry of suiteEntry.specs) {
      if (
        typeof specEntry.title !== 'string' ||
        specEntry.title.trim().length === 0
      ) {
        throw new Error('A spec entry is missing title.');
      }

      if (!Array.isArray(specEntry.tests)) {
        continue;
      }

      for (const testEntry of specEntry.tests) {
        parsedCaseResults.push(
          parseTestResultEntry(testEntry, specEntry.title),
        );
      }
    }
  }

  return parsedCaseResults;
}

@Injectable()
export class ResultsJsonIngestService {
  constructor(
    @Inject(PrismaService)
    private readonly prismaService: PrismaService,
  ) {}

  async ingestCaseResultsForRun(
    runId: number,
    resultsJson: string,
  ): Promise<ParsedPlaywrightCaseResult[]> {
    const parsedCaseResults = parsePlaywrightResultsJson(resultsJson);

    await this.prismaService.$transaction(async (transactionPrisma) => {
      for (const parsedCaseResult of parsedCaseResults) {
        await transactionPrisma.caseResult.create({
          data: {
            run_id: runId,
            test_lib_case_code: parsedCaseResult.test_lib_case_code,
            case_title: parsedCaseResult.case_title,
            status: parsedCaseResult.status,
            failed_at: parsedCaseResult.failed_at,
            duration_ms: parsedCaseResult.duration_ms,
          },
        });
      }
    });

    return parsedCaseResults;
  }
}
