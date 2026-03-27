import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

type FailureStatisticsRecord = {
  test_lib_case_code: string;
  case_title: string;
  fail_count: number;
  last_failed_at: Date;
  last_run_id: number;
};

@Injectable()
export class FailureStatisticsService {
  constructor(
    @Inject(PrismaService)
    private readonly prismaService: PrismaService,
  ) {}

  async getFailureStatistics() {
    const failedCaseResults = await this.prismaService.caseResult.findMany({
      where: {
        status: 'fail',
        failed_at: {
          not: null,
        },
      },
      select: {
        id: true,
        test_lib_case_code: true,
        case_title: true,
        failed_at: true,
        run_id: true,
      },
      orderBy: [
        {
          failed_at: 'desc',
        },
        {
          run_id: 'desc',
        },
        {
          id: 'desc',
        },
      ],
    });
    const failureStatisticsByCaseCode = new Map<
      string,
      FailureStatisticsRecord
    >();

    for (const failedCaseResult of failedCaseResults) {
      if (failedCaseResult.failed_at === null) {
        continue;
      }

      const existingFailureStatistics = failureStatisticsByCaseCode.get(
        failedCaseResult.test_lib_case_code,
      );

      if (existingFailureStatistics === undefined) {
        failureStatisticsByCaseCode.set(failedCaseResult.test_lib_case_code, {
          test_lib_case_code: failedCaseResult.test_lib_case_code,
          case_title: failedCaseResult.case_title,
          fail_count: 1,
          last_failed_at: failedCaseResult.failed_at,
          last_run_id: failedCaseResult.run_id,
        });
        continue;
      }

      existingFailureStatistics.fail_count += 1;
    }

    return [...failureStatisticsByCaseCode.values()].sort(
      (leftRecord, rightRecord) => {
        const failedAtDifference =
          rightRecord.last_failed_at.getTime() -
          leftRecord.last_failed_at.getTime();

        if (failedAtDifference !== 0) {
          return failedAtDifference;
        }

        const runIdDifference =
          rightRecord.last_run_id - leftRecord.last_run_id;

        if (runIdDifference !== 0) {
          return runIdDifference;
        }

        if (leftRecord.test_lib_case_code < rightRecord.test_lib_case_code) {
          return -1;
        }

        if (leftRecord.test_lib_case_code > rightRecord.test_lib_case_code) {
          return 1;
        }

        return 0;
      },
    );
  }
}
