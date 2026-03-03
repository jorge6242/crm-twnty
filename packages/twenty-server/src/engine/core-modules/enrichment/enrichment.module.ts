import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { EnrichmentWebhookController } from 'src/engine/core-modules/enrichment/controllers/enrichment-webhook.controller';
import { EnqueuePeopleEnrichmentTestCronCommand } from 'src/engine/core-modules/enrichment/crons/commands/enqueue-people-enrichment-test.cron.command';
import { EnqueuePeopleEnrichmentCronCommand } from 'src/engine/core-modules/enrichment/crons/commands/enqueue-people-enrichment.cron.command';
import { ProcessPeopleEnrichmentResultsTestCronCommand } from 'src/engine/core-modules/enrichment/crons/commands/process-people-enrichment-results-test.cron.command';
import { ProcessPeopleEnrichmentResultsCronCommand } from 'src/engine/core-modules/enrichment/crons/commands/process-people-enrichment-results.cron.command';
import { EnqueuePeopleEnrichmentCronJob } from 'src/engine/core-modules/enrichment/crons/jobs/enqueue-people-enrichment.cron.job';
import { ProcessPeopleEnrichmentResultsCronJob } from 'src/engine/core-modules/enrichment/crons/jobs/process-people-enrichment-results.cron.job';
import { PersonEnrichmentTrackingEntity } from 'src/engine/core-modules/enrichment/entities/person-enrichment-tracking.entity';
import { PeopleEnrichmentService } from 'src/engine/core-modules/enrichment/services/people-enrichment.service';
import { WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';
import { TwentyORMModule } from 'src/engine/twenty-orm/twenty-orm.module';
import { FullEnrichService } from 'src/services/fullenrich.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([PersonEnrichmentTrackingEntity, WorkspaceEntity]),
    TwentyORMModule,
  ],
  controllers: [EnrichmentWebhookController],
  providers: [
    PeopleEnrichmentService,
    FullEnrichService,
    EnqueuePeopleEnrichmentCronJob,
    ProcessPeopleEnrichmentResultsCronJob,
    EnqueuePeopleEnrichmentCronCommand,
    EnqueuePeopleEnrichmentTestCronCommand,
    ProcessPeopleEnrichmentResultsCronCommand,
    ProcessPeopleEnrichmentResultsTestCronCommand,
  ],
  exports: [
    PeopleEnrichmentService,
    EnqueuePeopleEnrichmentCronCommand,
    EnqueuePeopleEnrichmentTestCronCommand,
    ProcessPeopleEnrichmentResultsCronCommand,
    ProcessPeopleEnrichmentResultsTestCronCommand,
  ],
})
export class EnrichmentModule {}
