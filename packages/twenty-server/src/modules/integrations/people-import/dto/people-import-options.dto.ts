export type ConflictStrategy = 'merge' | 'skip' | 'create';

export class PeopleImportOptionsDto {
  conflictStrategy?: ConflictStrategy;
}
