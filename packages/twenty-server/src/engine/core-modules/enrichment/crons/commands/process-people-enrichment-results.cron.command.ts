import { Command, CommandRunner } from 'nest-commander';

import {
    PROCESS_PEOPLE_ENRICHMENT_RESULTS_CRON_PATTERN,
    ProcessPeopleEnrichmentResultsCronJob,
} from 'src/engine/core-modules/enrichment/crons/jobs/process-people-enrichment-results.cron.job';
import { InjectMessageQueue } from 'src/engine/core-modules/message-queue/decorators/message-queue.decorator';
import { MessageQueue } from 'src/engine/core-modules/message-queue/message-queue.constants';
import { MessageQueueService } from 'src/engine/core-modules/message-queue/services/message-queue.service';

@Command({
  name: 'cron:enrichment:process-people-enrichment-results',
  description: 'Starts a cron job to process people enrichment results',
})
export class ProcessPeopleEnrichmentResultsCronCommand extends CommandRunner {
  constructor(
    @InjectMessageQueue(MessageQueue.cronQueue)
    private readonly messageQueueService: MessageQueueService,
  ) {
    super();
  }

  async run(): Promise<void> {
    await this.messageQueueService.addCron<undefined>({
      jobName: ProcessPeopleEnrichmentResultsCronJob.name,
      data: undefined,
      options: {
        repeat: {
          pattern: PROCESS_PEOPLE_ENRICHMENT_RESULTS_CRON_PATTERN,
        },
      },
    });
  }
}
