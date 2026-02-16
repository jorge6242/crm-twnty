import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards
} from '@nestjs/common';

import { AuthenticatedRequest } from 'src/engine/api/rest/types/authenticated-request';
import { JwtAuthGuard } from 'src/engine/guards/jwt-auth.guard';
import { WorkspaceAuthGuard } from 'src/engine/guards/workspace-auth.guard';

import { MergeContactDto } from 'src/modules/integrations/social-accounts/dto/merge-contact.dto';
import { SocialAccountsService } from './social-accounts.service';

@UseGuards(JwtAuthGuard, WorkspaceAuthGuard)
@Controller(['metadata/social-accounts', 'rest/metadata/social-accounts'])
export class SocialAccountsController {
  constructor(private readonly service: SocialAccountsService) {}

  @Get("list")
  async getLeadUserAccounts(
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.getLeadUserAccounts(request.user);
  }

  @Post()
  async linkAccount(
    @Req() request: AuthenticatedRequest,
    @Body() input: { username: string; password: string },
  ) {
    return this.service.linkAccount(
      input.username,
      input.password,
      request.user,
      request.workspaceId,
    );
  }

  @Post('checkpoint')
  async solveCheckpoint(
    @Req() request: AuthenticatedRequest,
    @Body() input: { provider: string; code: string },
  ) {
    return this.service.solveCheckpoint(
      input.provider,
      input.code,
      request.user,
    );
  }


@Get(':provider')
async getProviderContacts(  // ← Cambiar nombre
  @Param('provider') provider: string,
  @Req() request: AuthenticatedRequest,
  @Query('cursor') cursor?: string,
) {
  return this.service.getProviderContacts(provider, request, cursor);  // ← Cambiar llamada
}

  @Delete('disconnect/:provider')
  async disconnectAccount(
    @Param('provider') provider: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.disconnectAccount(provider, request.user);
  }

  @Post('merge-contacts')
  async mergeContacts(
    @Req() request: AuthenticatedRequest,
    @Body() input: { contacts: MergeContactDto[] },
  ) {
    console.log('Merging contacts with input:', input);

    return this.service.mergeContactsToPeople(
      input.contacts,
      request,
    );
  }

    @Get('get-contact-detail/:contactId/:accountId')
  async getContactDetail(
    @Req() request: AuthenticatedRequest,
    @Param('contactId') contactId: string,
    @Param('accountId') accountId: string,
  ) {
    console.log('getContactDetail with input:', contactId, accountId);

    return this.service.getContactDetail(
      contactId,
      request.user,
    );
  }

  @Post('connect/microsoft')
  async connectMicrosoft(
    @Req() request: AuthenticatedRequest,
    @Body() body: { redirectUrl: string },
  ) {
    console.log('body.redirectUrl ', body.redirectUrl)
    const result = await this.service.generateMicrosoftAuthLink(
      request.user.id,
      request.workspaceId || '',
      body.redirectUrl,
    );

    return {
      authUrl: result.url,
      expiresAt: result.expires_at,
    };
  }
}
