import { HttpModule } from '@nestjs/axios';
import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { UnipileRestController } from './unipile-rest.controller';
import { UnipileWebhookController } from './unipile-webhook.controller';
import { UnipileController } from './unipile.controller';
import { UnipileService } from './unipile.service';

@Global()
@Module({
  imports: [
    HttpModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        baseURL: config.get('UNIPILE_BASE_URL') || 'https://api.unipile.com',
        headers: {
          Authorization: `Bearer ${config.get('UNIPILE_API_KEY') || ''}`,
        },
        timeout: 10000,
      }),
    }),
  ],
  controllers: [UnipileWebhookController, UnipileRestController, UnipileController],
  providers: [UnipileService],
  exports: [UnipileService],
})
export class UnipileModule {}
