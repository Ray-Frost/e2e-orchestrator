import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { RunArtifactsService } from './artifact-persistence/run-artifacts.service';
import { RunProbeService } from './run-probe.service';
import { ResultsJsonIngestService } from './results-json-ingest.service';
import { SmokeRunConfigService } from './smoke-run-config';
import { SmokeSuiteService } from './smoke-suite.service';
import { RunSchedulerService } from './run-scheduler.service';
import { RunsController } from './runs.controller';
import { RunsService } from './runs.service';

@Module({
  imports: [PrismaModule],
  controllers: [RunsController],
  providers: [
    RunArtifactsService,
    RunProbeService,
    ResultsJsonIngestService,
    SmokeRunConfigService,
    SmokeSuiteService,
    RunsService,
    RunSchedulerService,
  ],
  exports: [
    RunArtifactsService,
    RunProbeService,
    ResultsJsonIngestService,
    SmokeRunConfigService,
    SmokeSuiteService,
    RunsService,
    RunSchedulerService,
  ],
})
export class RunsModule {}
