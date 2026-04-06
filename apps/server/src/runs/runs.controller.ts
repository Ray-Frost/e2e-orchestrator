import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  NotFoundException,
  Param,
  Post,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { RunSchedulerService } from './run-scheduler.service';
import { RunsService } from './runs.service';
import { SmokeSuiteService } from './smoke-suite.service';

function parsePositiveIntegerPathParam(
  rawValue: string,
  label: string,
): number {
  if (!/^[1-9][0-9]*$/.test(rawValue)) {
    throw new BadRequestException({
      error: {
        message: `${label} must be a positive integer.`,
      },
    });
  }

  return Number(rawValue);
}

function assertEmptyActionRequestBody(requestBody: unknown): void {
  if (requestBody === null || requestBody === undefined) {
    return;
  }

  if (
    typeof requestBody !== 'object' ||
    Array.isArray(requestBody) ||
    Object.keys(requestBody).length > 0
  ) {
    throw new BadRequestException({
      error: {
        message: 'Request body must be empty.',
      },
    });
  }
}

@Controller()
export class RunsController {
  constructor(
    @Inject(RunsService)
    private readonly runsService: RunsService,
    @Inject(RunSchedulerService)
    private readonly runSchedulerService: RunSchedulerService,
    @Inject(SmokeSuiteService)
    private readonly smokeSuiteService: SmokeSuiteService,
  ) {}

  @Get('suites')
  async getSuites() {
    return this.smokeSuiteService.getSuiteSummaries();
  }

  @Post('runs')
  async createRun(
    @Body() requestBody: { suite_id?: number } | null | undefined,
  ) {
    if (
      requestBody === null ||
      requestBody === undefined ||
      typeof requestBody.suite_id !== 'number' ||
      !Number.isInteger(requestBody.suite_id) ||
      requestBody.suite_id <= 0
    ) {
      throw new BadRequestException({
        error: {
          message: 'suite_id must be a positive integer.',
        },
      });
    }

    const createdRun = await this.runsService.createPendingRun(
      requestBody.suite_id,
    );
    void this.runSchedulerService.enqueueRun(createdRun.id);

    return createdRun;
  }

  @Get('runs')
  async getRuns() {
    return this.runsService.listRuns();
  }

  @Get('runs/:id')
  async getRunById(@Param('id') id: string) {
    const runId = parsePositiveIntegerPathParam(id, 'id');
    const runDetail = await this.runsService.getRunById(runId);

    if (runDetail === null) {
      throw new NotFoundException({
        error: {
          message: `Run ${runId} was not found.`,
        },
      });
    }

    return runDetail;
  }

  @Get('runs/:id/stdout')
  async getRunStdoutById(
    @Param('id') id: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const runId = parsePositiveIntegerPathParam(id, 'id');
    const runStdout = await this.runsService.getRunStdoutById(runId);

    if (runStdout === null) {
      throw new NotFoundException({
        error: {
          message: `Run ${runId} was not found.`,
        },
      });
    }

    response.setHeader('Content-Type', 'text/plain; charset=utf-8');

    return runStdout;
  }

  @Post('runs/:id/cancel')
  @HttpCode(200)
  async cancelRunById(
    @Param('id') id: string,
    @Body() requestBody: Record<string, unknown> | null | undefined,
  ) {
    const runId = parsePositiveIntegerPathParam(id, 'id');
    assertEmptyActionRequestBody(requestBody);

    return this.runSchedulerService.cancelRun(runId);
  }
}
