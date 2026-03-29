import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { RunsModule } from './runs/runs.module';
import { StatisticsModule } from './statistics/statistics.module';

@Module({
  imports: [RunsModule, StatisticsModule],
})
export class AppModule {}
