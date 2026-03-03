import { Logger } from '@nestjs/common';
import { Command, CommandRunner } from 'nest-commander';

import { ProcessPeopleEnrichmentResultsCronJob } from 'src/engine/core-modules/enrichment/crons/jobs/process-people-enrichment-results.cron.job';

@Command({
  name: 'cron:enrichment:process-people-enrichment-results:test',
  description: 'Manually test the process people enrichment results job',
})
export class ProcessPeopleEnrichmentResultsTestCronCommand extends CommandRunner {
  private readonly logger = new Logger(
    ProcessPeopleEnrichmentResultsTestCronCommand.name,
  );

  constructor(
    private readonly processPeopleEnrichmentResultsCronJob: ProcessPeopleEnrichmentResultsCronJob,
  ) {
    super();
  }

  async run(): Promise<void> {
    this.logger.log(
      'Starting manual test of process people enrichment results job...',
    );
    await this.processPeopleEnrichmentResultsCronJob.handle();
    this.logger.log('Test completed.');
  }
}
