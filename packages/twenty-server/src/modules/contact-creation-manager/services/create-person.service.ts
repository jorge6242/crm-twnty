import { Injectable } from '@nestjs/common';

import { WorkspaceAuthContext } from 'src/engine/api/common/interfaces/workspace-auth-context.interface';

import { DeepPartial } from 'typeorm';

import { ActorFromAuthContextService } from 'src/engine/core-modules/actor/services/actor-from-auth-context.service';
import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import { type WorkspaceRepository } from 'src/engine/twenty-orm/repository/workspace.repository';
import { buildSystemAuthContext } from 'src/engine/twenty-orm/utils/build-system-auth-context.util';
import { PersonWorkspaceEntity } from 'src/modules/person/standard-objects/person.workspace-entity';

@Injectable()
export class CreatePersonService {
  constructor(
    private readonly globalWorkspaceOrmManager: GlobalWorkspaceOrmManager,
    private readonly actorFromAuthContextService: ActorFromAuthContextService,
  ) {}

  public async createPeople(
    peopleToCreate: Partial<PersonWorkspaceEntity>[],
    workspaceId: string,
    publicAuthContext?: WorkspaceAuthContext,
  ): Promise<DeepPartial<PersonWorkspaceEntity>[]> {
    if (peopleToCreate.length === 0) return [];

    const authContext =
      publicAuthContext ?? buildSystemAuthContext(workspaceId);

    return this.globalWorkspaceOrmManager.executeInWorkspaceContext(
      authContext,
      async () => {
        const personRepository =
          await this.globalWorkspaceOrmManager.getRepository(
            workspaceId,
            PersonWorkspaceEntity,
            {
              shouldBypassPermissionChecks: true,
            },
          );

        const lastPersonPosition =
          await this.getLastPersonPosition(personRepository);

        const peopleWithPosition = peopleToCreate.map((person, index) => ({
          ...person,
          position: lastPersonPosition + index,
        }));

        const peopleWithActor = publicAuthContext
          ? ((await this.actorFromAuthContextService.injectActorFieldsOnCreate({
              records: peopleWithPosition,
              objectMetadataNameSingular: 'person',
              authContext: publicAuthContext,
            })) as Partial<PersonWorkspaceEntity>[])
          : peopleWithPosition;

        const createdPeople = await personRepository.insert(
          peopleWithActor,
          undefined,
          ['companyId', 'id'],
        );

        return createdPeople.raw;
      },
    );
  }

  public async restorePeople(
    people: { personId: string; companyId: string | undefined }[],
    workspaceId: string,
  ): Promise<DeepPartial<PersonWorkspaceEntity>[]> {
    if (people.length === 0) {
      return [];
    }

    const authContext = buildSystemAuthContext(workspaceId);

    return this.globalWorkspaceOrmManager.executeInWorkspaceContext(
      authContext,
      async () => {
        const personRepository =
          await this.globalWorkspaceOrmManager.getRepository(
            workspaceId,
            PersonWorkspaceEntity,
            {
              shouldBypassPermissionChecks: true,
            },
          );

        const restoredPeople = await personRepository.updateMany(
          people.map(({ personId, companyId }) => ({
            criteria: personId,
            partialEntity: {
              deletedAt: null,
              companyId,
            },
          })),
          undefined,
          ['companyId', 'id'],
        );

        return restoredPeople.raw;
      },
    );
  }

  private async getLastPersonPosition(
    personRepository: WorkspaceRepository<PersonWorkspaceEntity>,
  ): Promise<number> {
    const lastPersonPosition = await personRepository.maximum(
      'position',
      undefined,
    );

    return lastPersonPosition ?? 0;
  }
}
