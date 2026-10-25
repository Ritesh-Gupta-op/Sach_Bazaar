import { BadRequestException, Body, Controller, Get, Headers, NotFoundException, Param, Post } from '@nestjs/common';
import { RELAY_ACTIONS, RelayService, type RelayAction } from './relay.service';
import { StorageService } from '../storage/storage.service';

@Controller('relay')
export class RelayController {
  constructor(
    private readonly relay: RelayService,
    private readonly storage: StorageService,
  ) {}

  @Get()
  info() {
    return { ...this.relay.info(), storage: { enabled: this.storage.isAvailable() } };
  }

  @Get('transactions/:txHash')
  async transaction(@Param('txHash') txHash: string) {
    if (!/^0x[0-9a-fA-F]{64}$/.test(txHash)) throw new BadRequestException('txHash must be a 0x-prefixed 32-byte hash');
    const record = await this.storage.getTransaction(txHash);
    if (!record) throw new NotFoundException(`Transaction ${txHash} not found`);
    return record;
  }

  @Post(':action')
  submit(@Param('action') action: string, @Body() body: unknown, @Headers('idempotency-key') idempotencyKey?: string) {
    if (!(RELAY_ACTIONS as readonly string[]).includes(action)) {
      throw new BadRequestException(`Unknown relay action "${action}". Valid: ${RELAY_ACTIONS.join(', ')}`);
    }
    return this.relay.submit(action as RelayAction, body, idempotencyKey);
  }
}
