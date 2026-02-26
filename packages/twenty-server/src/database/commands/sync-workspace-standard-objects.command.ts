import { InjectRepository } from '@nestjs/typeorm';

import { Command } from 'nest-commander';
import { type Repository } from 'typeorm';

import { ActiveOrSuspendedWorkspacesMigrationCommandRunner } from 'src/database/commands/command-runners/active-or-suspended-workspaces-migration.command-runner';
import { type RunOnWorkspaceArgs } from 'src/database/commands/command-runners/workspaces-migration.command-runner';
import { WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';
import { DataSourceService } from 'src/engine/metadata-modules/data-source/data-source.service';
import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import { WorkspaceMigrationBuilderException } from 'src/engine/workspace-manager/workspace-migration/exceptions/workspace-migration-builder-exception';
import { TwentyStandardApplicationService } from 'src/engine/workspace-manager/twenty-standard-application/services/twenty-standard-application.service';

@Command({
  name: 'workspace:sync-standard-objects',
  description:
    'Sync standard workspace objects (create new tables/fields) for all active and suspended workspaces. ' +
    'Run this after adding a new WorkspaceEntity or modifying existing standard objects.',
})
export class SyncWorkspaceStandardObjectsCommand extends ActiveOrSuspendedWorkspacesMigrationCommandRunner {
  constructor(
    @InjectRepository(WorkspaceEntity)
    protected readonly workspaceRepository: Repository<WorkspaceEntity>,
    protected readonly globalWorkspaceOrmManager: GlobalWorkspaceOrmManager,
    protected readonly dataSourceService: DataSourceService,
    private readonly twentyStandardApplicationService: TwentyStandardApplicationService,
  ) {
    super(workspaceRepository, globalWorkspaceOrmManager, dataSourceService);
  }

  override async runOnWorkspace({
    options,
    workspaceId,
  }: RunOnWorkspaceArgs): Promise<void> {
    if (options.dryRun) {
      this.logger.log(
        `[DRY RUN] Would sync standard objects for workspace ${workspaceId}`,
      );

      return;
    }

    try {
      await this.twentyStandardApplicationService.synchronizeTwentyStandardApplicationOrThrow(
        { workspaceId },
      );
    } catch (error) {
      if (error instanceof WorkspaceMigrationBuilderException) {
        this.logger.error(
          `Validation report for workspace ${workspaceId}:\n` +
            JSON.stringify(error.failedWorkspaceMigrationBuildResult, null, 2),
        );
      }
      throw error;
    }
  }
}
