import { Body, Controller, Get, Post } from '@nestjs/common';
import { AiService } from './ai.service';

@Controller('ai')
export class AiController {
  constructor(private readonly ai: AiService) {}

  @Get('health')
  health() {
    return this.ai.health();
  }

  @Post('grade')
  grade(@Body() body: { photoBase64?: string }) {
    return this.ai.grade(body?.photoBase64 ?? '');
  }
}
