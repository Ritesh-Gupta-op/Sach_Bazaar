import 'reflect-metadata';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

// The repo-root .env is the convention here; npm workspace runs have cwd = apps/api.
dotenv.config({ path: path.join(__dirname, '..', '..', '..', '.env') });
dotenv.config();

export async function createApp() {
  const app = await NestFactory.create(AppModule, { logger: false });
  app.setGlobalPrefix('v1', { exclude: ['health'] });
  app.enableCors({ origin: true });
  return app;
}

if (require.main === module) {
  createApp()
    .then((app) => app.listen(process.env.API_PORT ?? 3000))
    .then(() => console.log(`sachbazaar-api listening on port ${process.env.API_PORT ?? 3000}`))
    .catch((error) => {
      console.error('Failed to start sachbazaar-api:', error);
      process.exit(1);
    });
}
