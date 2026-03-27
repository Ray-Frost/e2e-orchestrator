import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { FailureStatisticsController } from './failures/failure-statistics.controller';
import { FailureStatisticsService } from './failures/failure-statistics.service';

@Module({
  imports: [PrismaModule],
  controllers: [FailureStatisticsController],
  providers: [FailureStatisticsService],
})
export class StatisticsModule {}
