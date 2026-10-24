import { Controller, Get, Param } from '@nestjs/common';
import { TraceService } from './trace.service';

@Controller()
export class TraceController {
  constructor(private readonly trace: TraceService) {}

  @Get('trace/:batchId')
  getTrace(@Param('batchId') batchId: string) {
    return this.trace.getTrace(batchId);
  }

  @Get('batches')
  listBatches() {
    return this.trace.listDemoBatches();
  }
}
