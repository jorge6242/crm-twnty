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

export const PROCESS_PEOPLE_ENRICHMENT_RESULTS_CRON_PATTERN = '*/30 * * * *'; // Every 30 minutes

@Processor(MessageQueue.cronQueue)
export class ProcessPeopleEnrichmentResultsCronJob {
  constructor(
    @InjectRepository(WorkspaceEntity)
    private readonly workspaceRepository: Repository<WorkspaceEntity>,
    private readonly peopleEnrichmentService: PeopleEnrichmentService,
    private readonly exceptionHandlerService: ExceptionHandlerService,
  ) {}

  @Process(ProcessPeopleEnrichmentResultsCronJob.name)
  @SentryCronMonitor(
    ProcessPeopleEnrichmentResultsCronJob.name,
    PROCESS_PEOPLE_ENRICHMENT_RESULTS_CRON_PATTERN,
  )
  async handle(): Promise<void> {
    const activeWorkspaces = await this.workspaceRepository.find({
      where: {
        activationStatus: WorkspaceActivationStatus.ACTIVE,
      },
    });

    for (const workspace of activeWorkspaces) {
      try {
        // Process completed enrichments and update JobHistory
        await this.peopleEnrichmentService.processEnrichmentResults(
          workspace.id,
        );

        // Get stats for monitoring
        const stats =
          await this.peopleEnrichmentService.getEnrichmentStats(workspace.id);

        console.log(
          `Processed enrichment results for workspace ${workspace.id}:`,
          stats,
        );
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
