import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { FullEnrichService } from 'src/services/fullenrich.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [FullEnrichService],
  exports: [FullEnrichService],
})
export class FullEnrichModule {}
