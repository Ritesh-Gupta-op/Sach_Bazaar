import { Module } from '@nestjs/common';
import { HealthModule } from './health/health.module';
import { ChainModule } from './chain/chain.module';
import { TraceModule } from './trace/trace.module';
import { RelayModule } from './relay/relay.module';
import { AiModule } from './ai/ai.module';
import { StorageModule } from './storage/storage.module';

@Module({
  imports: [HealthModule, ChainModule, StorageModule, TraceModule, RelayModule, AiModule],
})
export class AppModule {}
