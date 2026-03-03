import { Logger } from '@nestjs/common';
import { Command, CommandRunner } from 'nest-commander';

import { EnqueuePeopleEnrichmentCronJob } from 'src/engine/core-modules/enrichment/crons/jobs/enqueue-people-enrichment.cron.job';

@Command({
  name: 'cron:enrichment:enqueue-people-enrichment:test',
  description: 'Manually test the enqueue people enrichment job',
})
export class EnqueuePeopleEnrichmentTestCronCommand extends CommandRunner {
  private readonly logger = new Logger(
    EnqueuePeopleEnrichmentTestCronCommand.name,
  );

  constructor(
    private readonly enqueuePeopleEnrichmentCronJob: EnqueuePeopleEnrichmentCronJob,
  ) {
    super();
  }

  async run(): Promise<void> {
    this.logger.log('Starting manual test of enqueue people enrichment job...');
    await this.enqueuePeopleEnrichmentCronJob.handle();
    this.logger.log('Test completed.');
  }
}
