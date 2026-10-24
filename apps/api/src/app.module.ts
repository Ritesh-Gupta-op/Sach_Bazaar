import { Module } from '@nestjs/common';
import { HealthModule } from './health/health.module';
import { ChainModule } from './chain/chain.module';
import { TraceModule } from './trace/trace.module';
import { RelayModule } from './relay/relay.module';

@Module({
  imports: [HealthModule, ChainModule, TraceModule, RelayModule],
})
export class AppModule {}
