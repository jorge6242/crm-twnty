import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { UnipileService } from './unipile.service';

@Controller('integrations/unipile')
export class UnipileWebhookController {
  constructor(private readonly unipileService: UnipileService) {}

  @Get('hello')
  getHello() {
    console.log('flag');
    return 'flag';
  }

  // test webhook endpoint — just echoes back minimal ack
  @Post('webhook')
  @HttpCode(200)
  handleWebhook(@Body() payload: any) {
    // quick log for dev — keep minimal
    // eslint-disable-next-line no-console
    console.log('[Unipile webhook] received', payload && payload.type ? payload.type : 'no-type');
    return { ok: true };
  }
}
