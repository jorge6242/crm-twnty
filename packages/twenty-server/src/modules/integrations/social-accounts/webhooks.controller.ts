import { Body, Controller, Logger, Post, UseGuards } from '@nestjs/common';
import { NoPermissionGuard } from 'src/engine/guards/no-permission.guard';
import { PublicEndpointGuard } from 'src/engine/guards/public-endpoint.guard';
import { SocialAccountsService } from './social-accounts.service';

@Controller('webhooks')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);
  constructor(private readonly socialAccountsService: SocialAccountsService) {}

  @Post('unipile')
  @UseGuards(PublicEndpointGuard, NoPermissionGuard)
  async handleUnipileWebhook(
    @Body() payload: {
      account_id: string;
      custom_id: string;
      status: string;
      name: string;
      user_id: string;
      AccountStatus: {
        message: string;
      };
    },
  ) {
    this.logger.log('Webhook received from Unipile:', payload);
    return this.socialAccountsService.handleAccountConnected(payload);
  }
}
