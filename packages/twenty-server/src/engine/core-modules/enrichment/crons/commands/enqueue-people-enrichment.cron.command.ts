import { Command, CommandRunner } from 'nest-commander';

import {
    ENQUEUE_PEOPLE_ENRICHMENT_CRON_PATTERN,
    EnqueuePeopleEnrichmentCronJob,
} from 'src/engine/core-modules/enrichment/crons/jobs/enqueue-people-enrichment.cron.job';
import { InjectMessageQueue } from 'src/engine/core-modules/message-queue/decorators/message-queue.decorator';
import { MessageQueue } from 'src/engine/core-modules/message-queue/message-queue.constants';
import { MessageQueueService } from 'src/engine/core-modules/message-queue/services/message-queue.service';

@Command({
  name: 'cron:enrichment:enqueue-people-enrichment',
  description: 'Starts a cron job to enqueue people for enrichment',
})
export class EnqueuePeopleEnrichmentCronCommand extends CommandRunner {
  constructor(
    @InjectMessageQueue(MessageQueue.cronQueue)
    private readonly messageQueueService: MessageQueueService,
  ) {
    super();
  }

  async run(): Promise<void> {
    await this.messageQueueService.addCron<undefined>({
      jobName: EnqueuePeopleEnrichmentCronJob.name,
      data: undefined,
      options: {
        repeat: {
          pattern: ENQUEUE_PEOPLE_ENRICHMENT_CRON_PATTERN,
        },
      },
    });
  }
}
