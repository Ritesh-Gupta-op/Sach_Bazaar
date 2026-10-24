import 'reflect-metadata';
import { Controller, Get, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

@Controller('health')
class HealthController {
  @Get()
  getHealth(): { status: 'ok'; service: string } {
    return { status: 'ok', service: 'sachbazaar-api' };
  }
}

@Module({ controllers: [HealthController] })
class AppModule {}

export async function createApp() {
  return NestFactory.create(AppModule, { logger: false });
}

if (require.main === module) {
  void createApp().then((app) => app.listen(process.env.API_PORT ?? 3000));
}
