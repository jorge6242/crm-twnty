import { InjectRepository } from '@nestjs/typeorm';
import { WorkspaceActivationStatus } from 'twenty-shared/workspace';
import { Repository } from 'typeorm';

import { SentryCronMonitor } from 'src/engine/core-modules/cron/sentry-cron-monitor.decorator';
import { PeopleEnrichmentService } from 'src/engine/core-modules/enrichment/services/people-enrichment.service';
import { ExceptionHandlerService } from 'src/engine/core-modules/exception-handler/exception-handler.service';
import { Process } from 'src/engine/core-modules/message-queue/decorators/process.decorator';
import { Processor } from 'src/engine/core-modules/message-queue/decorators/processor.decorator';
import { MessageQueue } from 'src/engine/core-modules/message-queue/message-queue.constants';
import { WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';

export const ENQUEUE_PEOPLE_ENRICHMENT_CRON_PATTERN = '0 2 * * 1'; // Every Monday at 2:00 AM

@Processor(MessageQueue.cronQueue)
export class EnqueuePeopleEnrichmentCronJob {
  constructor(
    @InjectRepository(WorkspaceEntity)
    private readonly workspaceRepository: Repository<WorkspaceEntity>,
    private readonly peopleEnrichmentService: PeopleEnrichmentService,
    private readonly exceptionHandlerService: ExceptionHandlerService,
  ) {}

  @Process(EnqueuePeopleEnrichmentCronJob.name)
  @SentryCronMonitor(
    EnqueuePeopleEnrichmentCronJob.name,
    ENQUEUE_PEOPLE_ENRICHMENT_CRON_PATTERN,
  )
  async handle(): Promise<void> {
    const activeWorkspaces = await this.workspaceRepository.find({
      where: {
        activationStatus: WorkspaceActivationStatus.ACTIVE,
      },
    });

    for (const workspace of activeWorkspaces) {
      try {
        const BATCH_SIZE = 50; // FullEnrich bulk API limit is 100, we use 50 for safety
        const MAX_BATCHES_PER_RUN = 10; // Max 500 people per workspace per day (adjustable)
        let totalEnqueued = 0;
        let batchCount = 0;

        // Process in batches until no more people to enrich or max batches reached
        while (batchCount < MAX_BATCHES_PER_RUN) {
          // Find people to enrich (batch of 50)
          const peopleToEnrich =
            await this.peopleEnrichmentService.findPeopleToEnrich(
              workspace.id,
              BATCH_SIZE,
            );

          if (peopleToEnrich.length === 0) {
            // No more people to enrich
            break;
          }

          // Create tracking records
          const trackingRecords =
            await this.peopleEnrichmentService.createEnrichmentTracking(
              workspace.id,
              peopleToEnrich.map((p) => p.id),
            );

          // Start enrichment process
          await this.peopleEnrichmentService.enrichPeople(
            workspace.id,
            trackingRecords,
          );

          totalEnqueued += peopleToEnrich.length;
          batchCount++;

          console.log(
            `[Batch ${batchCount}] Enqueued ${peopleToEnrich.length} people for enrichment in workspace ${workspace.id}`,
          );

          // If we got less than BATCH_SIZE, we've processed all available
          if (peopleToEnrich.length < BATCH_SIZE) {
            break;
          }
        }

        if (totalEnqueued > 0) {
          console.log(
            `Total enqueued: ${totalEnqueued} people in ${batchCount} batches for workspace ${workspace.id}`,
          );
        }
      } catch (error) {
        this.exceptionHandlerService.captureExceptions([error], {
          workspace: {
            id: workspace.id,
          },
        });
      }
    }
  }
}
