import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';

import { AuthModule } from 'src/engine/core-modules/auth/auth.module';
import { WorkspaceCacheStorageModule } from 'src/engine/workspace-cache-storage/workspace-cache-storage.module';
import { PeopleImportController } from 'src/modules/integrations/people-import/people-import.controller';
import { PeopleImportService } from 'src/modules/integrations/people-import/people-import.service';

@Module({
  imports: [
    MulterModule.register({}), // in-memory, no disk writes
    AuthModule,
    WorkspaceCacheStorageModule,
  ],
  controllers: [PeopleImportController],
  providers: [PeopleImportService],
})
export class PeopleImportModule {}
