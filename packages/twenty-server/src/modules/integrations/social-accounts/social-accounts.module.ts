import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ActorModule } from 'src/engine/core-modules/actor/actor.module';
import { AuthModule } from 'src/engine/core-modules/auth/auth.module';
import { LeadUserEntity } from 'src/engine/core-modules/user/lead-user.entity';
import { WorkspaceCacheStorageModule } from 'src/engine/workspace-cache-storage/workspace-cache-storage.module';
import { CreatePersonService } from 'src/modules/contact-creation-manager/services/create-person.service';
import { UnipileService } from 'src/services/unipile.service';
import { SocialAccountsController } from './social-accounts.controller';
import { SocialAccountsService } from './social-accounts.service';

@Module({
  controllers: [SocialAccountsController],
  providers: [SocialAccountsService, UnipileService, CreatePersonService ],
  imports: [
    AuthModule,
    WorkspaceCacheStorageModule,
    TypeOrmModule.forFeature([LeadUserEntity]),
    ActorModule,
  ],
})
export class SocialAccountsModule {}
