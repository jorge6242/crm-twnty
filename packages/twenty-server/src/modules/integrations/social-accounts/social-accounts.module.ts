import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ActorModule } from 'src/engine/core-modules/actor/actor.module';
import { AuthModule } from 'src/engine/core-modules/auth/auth.module';
import { LeadUserEntity } from 'src/engine/core-modules/user/lead-user.entity';
import { UserEntity } from 'src/engine/core-modules/user/user.entity';
import { NoPermissionGuard } from 'src/engine/guards/no-permission.guard';
import { PublicEndpointGuard } from 'src/engine/guards/public-endpoint.guard';
import { WorkspaceCacheStorageModule } from 'src/engine/workspace-cache-storage/workspace-cache-storage.module';
import { CreatePersonService } from 'src/modules/contact-creation-manager/services/create-person.service';
import { WebhookController } from 'src/modules/integrations/social-accounts/webhooks.controller';
import { UnipileService } from 'src/services/unipile.service';
import { SocialAccountsController } from './social-accounts.controller';
import { SocialAccountsService } from './social-accounts.service';

@Module({
  controllers: [SocialAccountsController, WebhookController],
  providers: [SocialAccountsService, UnipileService, CreatePersonService, PublicEndpointGuard, NoPermissionGuard ],
  imports: [
    AuthModule,
    WorkspaceCacheStorageModule,
    TypeOrmModule.forFeature([LeadUserEntity, UserEntity]),
    ActorModule,
  ],
})
export class SocialAccountsModule {}
