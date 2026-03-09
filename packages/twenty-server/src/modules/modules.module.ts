import { Module } from '@nestjs/common';

import { CalendarModule } from 'src/modules/calendar/calendar.module';
import { ConnectedAccountModule } from 'src/modules/connected-account/connected-account.module';
import { FavoriteFolderModule } from 'src/modules/favorite-folder/favorite-folder.module';
import { FavoriteModule } from 'src/modules/favorite/favorite.module';
import { FullEnrichModule } from 'src/modules/integrations/fullenrich/fullenrich.module';
import { PeopleImportModule } from 'src/modules/integrations/people-import/people-import.module';
import { SocialAccountsModule } from 'src/modules/integrations/social-accounts/social-accounts.module';
import { UnipileModule } from 'src/modules/integrations/unipile/unipile.module';
import { MessagingModule } from 'src/modules/messaging/messaging.module';
import { WorkflowModule } from 'src/modules/workflow/workflow.module';

@Module({
  imports: [
    MessagingModule,
    CalendarModule,
    ConnectedAccountModule,
    WorkflowModule,
    FavoriteFolderModule,
    FavoriteModule,
    UnipileModule,
    SocialAccountsModule,
    FullEnrichModule,
    PeopleImportModule,
  ],
  providers: [],
  exports: [],
})
export class ModulesModule {}
