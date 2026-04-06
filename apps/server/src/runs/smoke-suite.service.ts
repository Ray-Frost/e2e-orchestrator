import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  buildConfiguredSmokeSuites,
  SmokeRunConfigService,
  type SmokeSuiteSeed,
} from './smoke-run-config';

export interface SmokeSuiteSummary {
  id: number;
  suite_name: string;
  command: string;
  sut_base_url: string;
}

interface SmokeSuiteRecord {
  id: number;
  suite_name: string;
  command: string;
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
    await this.syncConfiguredSuites();
  }

  private getConfiguredSuiteSeeds(): SmokeSuiteSeed[] {
    const smokeRunConfig = this.smokeRunConfigService.getConfig();

    return buildConfiguredSmokeSuites(smokeRunConfig);
  }

  async syncConfiguredSuites(): Promise<SmokeSuiteRecord[]> {
    const configuredSuiteSeeds = this.getConfiguredSuiteSeeds();

    return this.prismaService.$transaction(async (transactionPrisma) => {
      const configuredSuiteRecords: SmokeSuiteRecord[] = [];

      for (const configuredSuiteSeed of configuredSuiteSeeds) {
        const configuredSuiteRecord = (await transactionPrisma.suite.upsert({
          where: {
            suite_name: configuredSuiteSeed.suiteName,
          },
          create: {
            suite_name: configuredSuiteSeed.suiteName,
            command: configuredSuiteSeed.command,
          },
          update: {
            command: configuredSuiteSeed.command,
          },
          select: {
            id: true,
            suite_name: true,
            command: true,
          },
        })) as SmokeSuiteRecord;

        configuredSuiteRecords.push(configuredSuiteRecord);
      }

      return configuredSuiteRecords;
    });
  }

  async getSuiteSummaries(): Promise<SmokeSuiteSummary[]> {
    const suiteRecords = await this.syncConfiguredSuites();
    const smokeRunConfig = this.smokeRunConfigService.getConfig();

    return suiteRecords.map((suiteRecord) => ({
      id: suiteRecord.id,
      suite_name: suiteRecord.suite_name,
      command: suiteRecord.command,
      sut_base_url: smokeRunConfig.sutBaseUrl,
    }));
  }

  async getSuiteById(suiteId: number) {
    const configuredSuiteRecords = await this.syncConfiguredSuites();

    return (
      configuredSuiteRecords.find(
        (configuredSuiteRecord) => configuredSuiteRecord.id === suiteId,
      ) ?? null
    );
  }
}
