import { Module } from '@nestjs/common';
import { UnipileRestController } from './unipile-rest.controller';
import { UnipileWebhookController } from './unipile-webhook.controller';
import { UnipileService } from './unipile.service';

@Module({
  imports: [],
  controllers: [UnipileWebhookController],
  controllers: [UnipileWebhookController, UnipileRestController],
  providers: [UnipileService],
  exports: [UnipileService],
})
export class UnipileModule {}
