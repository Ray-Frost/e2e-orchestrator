import {
  Controller,
  Get,
  Inject,
  InternalServerErrorException,
} from '@nestjs/common';
import { FailureStatisticsService } from './failure-statistics.service';

@Controller('statistics')
export class FailureStatisticsController {
  constructor(
    @Inject(FailureStatisticsService)
    private readonly failureStatisticsService: FailureStatisticsService,
  ) {}

  @Get('failures')
  async getFailureStatistics() {
    try {
      return await this.failureStatisticsService.getFailureStatistics();
    } catch {
      throw new InternalServerErrorException({
        error: {
          message: 'Failed to load failure statistics.',
        },
      });
    }
  }
}
