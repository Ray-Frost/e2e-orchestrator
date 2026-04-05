import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SmokeRunConfigService } from './smoke-run-config';

export interface SmokeSuiteSummary {
  id: number;
  suite_name: string;
  command: string;
  sut_base_url: string;
}

@Injectable()
export class SmokeSuiteService implements OnModuleInit {
  constructor(
    @Inject(PrismaService)
    private readonly prismaService: PrismaService,
    @Inject(SmokeRunConfigService)
    private readonly smokeRunConfigService: SmokeRunConfigService,
  ) {}

  async onModuleInit() {
    await this.syncSingletonSuite();
  }

  async syncSingletonSuite() {
    const smokeRunConfig = this.smokeRunConfigService.getConfig();

    return this.prismaService.$transaction(async (transactionPrisma) => {
      const canonicalSuite = await transactionPrisma.suite.upsert({
        where: {
          suite_name: smokeRunConfig.suiteName,
        },
        create: {
          suite_name: smokeRunConfig.suiteName,
          command: smokeRunConfig.command,
        },
        update: {
          command: smokeRunConfig.command,
        },
      });

      await transactionPrisma.run.updateMany({
        where: {
          suite_id: {
            not: canonicalSuite.id,
          },
        },
        data: {
          suite_id: canonicalSuite.id,
        },
      });

      await transactionPrisma.suite.deleteMany({
        where: {
          id: {
            not: canonicalSuite.id,
          },
        },
      });

      return canonicalSuite;
    });
  }

  async getSingletonSuiteSummaries(): Promise<SmokeSuiteSummary[]> {
    const suiteRecord = await this.syncSingletonSuite();
    const smokeRunConfig = this.smokeRunConfigService.getConfig();

    return [
      {
        id: suiteRecord.id,
        suite_name: suiteRecord.suite_name,
        command: suiteRecord.command,
        sut_base_url: smokeRunConfig.sutBaseUrl,
      },
    ];
  }

  async getSuiteById(suiteId: number) {
    const suiteRecord = await this.syncSingletonSuite();

    if (suiteRecord.id !== suiteId) {
      return null;
    }

    return suiteRecord;
  }
}
