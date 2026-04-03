import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { startBackendServer } from './start-backend-server';

const isLocalDevPortRegistryEnabled =
  process.env.LOCAL_DEV_PORT_REGISTRY === '1';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  await startBackendServer({
    app,
    configuredPortValue: process.env.PORT,
    isLocalDevPortRegistryEnabled,
    shouldEnablePortFallback: isLocalDevPortRegistryEnabled,
  });
}
void bootstrap();
