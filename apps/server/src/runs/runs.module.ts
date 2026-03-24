import { Module } from '@nestjs/common';
import { RunArtifactsService } from './artifact-persistence/run-artifacts.service';

@Module({
  providers: [RunArtifactsService],
  exports: [RunArtifactsService],
})
export class RunsModule {}
