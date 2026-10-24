import { BadRequestException, Body, Controller, Get, Param, Post } from '@nestjs/common';
import { RELAY_ACTIONS, RelayService, type RelayAction } from './relay.service';

@Controller('relay')
export class RelayController {
  constructor(private readonly relay: RelayService) {}

  @Get()
  info() {
    return this.relay.info();
  }

  @Post(':action')
  submit(@Param('action') action: string, @Body() body: unknown) {
    if (!(RELAY_ACTIONS as readonly string[]).includes(action)) {
      throw new BadRequestException(`Unknown relay action "${action}". Valid: ${RELAY_ACTIONS.join(', ')}`);
    }
    return this.relay.submit(action as RelayAction, body);
  }
}
