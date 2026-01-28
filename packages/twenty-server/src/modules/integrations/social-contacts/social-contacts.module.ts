import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SocialContactsService } from 'src/modules/integrations/social-contacts/social-contact.service';
import { SocialContactsController } from './social-contacts.controller';

@Module({
  controllers: [SocialContactsController],
  providers: [SocialContactsService],
  imports: [
        HttpModule.registerAsync({
          imports: [ConfigModule],
          inject: [ConfigService],
          useFactory: (config: ConfigService) => ({
            baseURL: 'https://api26.unipile.com:15694/api/v1',
            headers: { 'X-API-KEY': "GJkkETZc.MqhshiFpdO95MWBUHRzHbsbgalIK3El0J+p5acmljGI=", Accept: 'application/json'},
            timeout: 10000,
          }),
        }),
  ]
})
export class SocialContactsModule {}
