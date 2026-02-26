import { BaseWorkspaceEntity } from 'src/engine/twenty-orm/base.workspace-entity';
import { type EntityRelation } from 'src/engine/workspace-manager/workspace-migration/types/entity-relation.interface';
import { type CompanyWorkspaceEntity } from 'src/modules/company/standard-objects/company.workspace-entity';
import { type PersonWorkspaceEntity } from 'src/modules/person/standard-objects/person.workspace-entity';

export class PersonJobHistoryWorkspaceEntity extends BaseWorkspaceEntity {
  jobTitle: string | null;
  startDate: string | null;
  endDate: string | null;
  isCurrent: boolean;
  source: string | null;
  person: EntityRelation<PersonWorkspaceEntity> | null;
  personId: string | null;
  company: EntityRelation<CompanyWorkspaceEntity> | null;
  companyId: string | null;
}
