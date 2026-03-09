import { Injectable, Logger } from '@nestjs/common';


import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import { WorkspaceRepository } from 'src/engine/twenty-orm/repository/workspace.repository';
import { buildSystemAuthContext } from 'src/engine/twenty-orm/utils/build-system-auth-context.util';
import { CompanyWorkspaceEntity } from 'src/modules/company/standard-objects/company.workspace-entity';
import { ConflictStrategy } from 'src/modules/integrations/people-import/dto/people-import-options.dto';
import { ImportSummaryDto } from 'src/modules/integrations/people-import/dto/people-import-result.dto';
import {
  BATCH_SIZE,
  buildMissingCompanies,
  buildPersonEntity,
  buildPersonUpdate,
  createEmptySummary,
  createSummary,
  extractEntityEmail,
  extractPrimaryCompany,
  mapRow,
  parseCsv,
  type CreateEntry,
  type UpdateEntry,
  type ValidRow,
} from 'src/modules/integrations/people-import/people-import.utils';
import { PersonWorkspaceEntity } from 'src/modules/person/standard-objects/person.workspace-entity';

/**
 * Orchestrates the CSV-to-Person import pipeline.
 *
 * Responsibilities:
 * - Coordinate parsing, validation, classification, and DB persistence
 * - Ensure atomicity via QueryRunner transactions
 * - Delegate pure data transformations to `people-import.utils`
 */
@Injectable()
export class PeopleImportService {
  private readonly logger = new Logger(PeopleImportService.name);

  constructor(
    private readonly globalWorkspaceOrmManager: GlobalWorkspaceOrmManager,
  ) {}

  // ── Public API ──────────────────────────────────────────────────────────

  /**
   * Orchestrates the full CSV import pipeline within a single DB transaction.
   *
   * Flow: parse → validate → resolve companies → classify → bulk insert/update
   *
   * @param workspaceId      - Target workspace UUID
   * @param fileBuffer       - Raw CSV file content as a `Buffer`
   * @param conflictStrategy - How to handle rows whose email already exists
   * @returns An `ImportSummaryDto` with per-row results and final counters
   */
  async importFromCsv(
    workspaceId: string,
    fileBuffer: Buffer,
    conflictStrategy: ConflictStrategy,
  ): Promise<ImportSummaryDto> {
    const rows = parseCsv(fileBuffer.toString('utf-8'));

    if (rows.length === 0) {
      return createEmptySummary('CSV is empty or has no data rows');
    }

    const summary = createSummary(rows.length);
    const validRows = this.validateRows(rows, summary);

    if (validRows.length === 0) return summary;

    const authContext = buildSystemAuthContext(workspaceId);

    await this.globalWorkspaceOrmManager.executeInWorkspaceContext(
      authContext,
      async () => {
        const personRepo = await this.getPersonRepository(workspaceId);
        const companyRepo = await this.getCompanyRepository(workspaceId);

        const companyNameToId = await this.resolveCompanies(
          validRows.map((r) => r.mapped.companyName),
          companyRepo,
        );

        const existingMap = await this.fetchExistingPersons(
          validRows.map((r) => r.email),
          personRepo,
        );

        const lastPosition = (await personRepo.maximum('position')) ?? 0;

        const { toCreate, toUpdate } = this.classifyRows(
          validRows,
          existingMap,
          companyNameToId,
          conflictStrategy,
          lastPosition,
          summary,
        );

        await this.executeInTransaction(
          toCreate,
          toUpdate,
          personRepo,
          summary,
        );
      },
    );

    summary.rows.sort((a, b) => a.row - b.row);

    return summary;
  }

  // ── Transaction wrapper ────────────────────────────────────────────────

  /**
   * Wraps the bulk insert + update operations in a single database transaction
   * using a `QueryRunner`. If any step fails, the entire operation is rolled
   * back to maintain data consistency.
   *
   * @param toCreate   - Persons to be inserted
   * @param toUpdate   - Persons to be updated
   * @param personRepo - Workspace repository for the Person entity
   * @param summary    - Import summary DTO to record results
   */
  private async executeInTransaction(
    toCreate: CreateEntry[],
    toUpdate: UpdateEntry[],
    personRepo: WorkspaceRepository<PersonWorkspaceEntity>,
    summary: ImportSummaryDto,
  ): Promise<void> {
    const dataSource =
      await this.globalWorkspaceOrmManager.getGlobalWorkspaceDataSource();
    const queryRunner = dataSource.createQueryRunner();

    await queryRunner.connect();

    try {
      await queryRunner.startTransaction();
      this.logger.log(
        `[PeopleImport] Transaction started — ${toCreate.length} inserts, ${toUpdate.length} updates`,
      );

      await this.bulkInsertPersons(toCreate, personRepo, summary);
      await this.bulkUpdatePersons(toUpdate, personRepo, summary);

      await queryRunner.commitTransaction();
      this.logger.log(
        `[PeopleImport] Transaction committed — created: ${summary.created}, updated: ${summary.updated}`,
      );
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `[PeopleImport] Transaction rolled back — ${error instanceof Error ? error.message : String(error)}`,
      );

      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  // ── Repository access ───────────────────────────────────────────────────

  /**
   * Obtains a permission-bypassed repository for `PersonWorkspaceEntity`.
   *
   * @param workspaceId - Target workspace UUID
   * @returns A `WorkspaceRepository` scoped to the given workspace
   */
  private getPersonRepository(workspaceId: string) {
    return this.globalWorkspaceOrmManager.getRepository(
      workspaceId,
      PersonWorkspaceEntity,
      { shouldBypassPermissionChecks: true },
    );
  }

  /**
   * Obtains a permission-bypassed repository for `CompanyWorkspaceEntity`.
   *
   * @param workspaceId - Target workspace UUID
   * @returns A `WorkspaceRepository` scoped to the given workspace
   */
  private getCompanyRepository(workspaceId: string) {
    return this.globalWorkspaceOrmManager.getRepository(
      workspaceId,
      CompanyWorkspaceEntity,
      { shouldBypassPermissionChecks: true },
    );
  }

  // ── Row validation ──────────────────────────────────────────────────────

  /**
   * Filters parsed CSV rows, rejecting those without an email address.
   * Rejected rows are recorded as errors in the summary.
   *
   * @param rows    - Array of raw `CsvRow` objects from `parseCsv`
   * @param summary - Import summary DTO to record validation errors
   * @returns Array of `ValidRow` objects that passed validation
   */
  private validateRows(
    rows: ReturnType<typeof parseCsv>,
    summary: ImportSummaryDto,
  ): ValidRow[] {
    const validRows: ValidRow[] = [];

    for (let i = 0; i < rows.length; i++) {
      const rowNumber = i + 2;
      const mapped = mapRow(rows[i]);
      const email = mapped.email?.trim() || '';

      if (!email) {
        summary.rows.push({
          row: rowNumber,
          status: 'error',
          message: 'Email is required',
        });
        summary.errors++;
      } else {
        validRows.push({ rowNumber, mapped, email });
      }
    }

    return validRows;
  }

  // ── Person lookup ───────────────────────────────────────────────────────

  /**
   * Fetches existing persons by their primary email address, using batched
   * queries to avoid exceeding parameter limits. Returns a `Map` for O(1)
   * lookups during classification.
   *
   * @param emails     - List of email addresses to search for
   * @param personRepo - Workspace repository for Person entities
   * @returns A `Map<email, PersonWorkspaceEntity>` of existing records
   */
  private async fetchExistingPersons(
    emails: string[],
    personRepo: WorkspaceRepository<PersonWorkspaceEntity>,
  ): Promise<Map<string, PersonWorkspaceEntity>> {
    const existingMap = new Map<string, PersonWorkspaceEntity>();

    for (let i = 0; i < emails.length; i += BATCH_SIZE) {
      const batch = emails.slice(i, i + BATCH_SIZE);
      const existing = await personRepo
        .createQueryBuilder('person')
        .where('person.emailsPrimaryEmail IN (:...emails)', {
          emails: batch,
        })
        .withDeleted()
        .getMany();

      for (const person of existing) {
        existingMap.set(person.emails.primaryEmail, person);
      }
    }

    return existingMap;
  }

  // ── Row classification ──────────────────────────────────────────────────

  /**
   * Classifies validated rows into create, update, or skip buckets based on
   * whether the person email already exists and the chosen conflict strategy.
   *
   * @param validRows        - Rows that passed email validation
   * @param existingMap      - Map of existing persons keyed by email
   * @param companyNameToId  - Map of company name → UUID
   * @param conflictStrategy - How to handle duplicates: `merge`, `skip`, or `create`
   * @param lastPosition     - Current maximum person position in the workspace
   * @param summary          - Import summary DTO to record skipped rows
   * @returns Object with `toCreate` and `toUpdate` arrays
   */
  private classifyRows(
    validRows: ValidRow[],
    existingMap: Map<string, PersonWorkspaceEntity>,
    companyNameToId: Map<string, string>,
    conflictStrategy: ConflictStrategy,
    lastPosition: number,
    summary: ImportSummaryDto,
  ): { toCreate: CreateEntry[]; toUpdate: UpdateEntry[] } {
    const toCreate: CreateEntry[] = [];
    const toUpdate: UpdateEntry[] = [];
    let positionOffset = 0;

    for (const { rowNumber, mapped, email } of validRows) {
      const existing = existingMap.get(email);
      const companyId = companyNameToId.get(
        extractPrimaryCompany(mapped.companyName),
      );

      if (!existing) {
        toCreate.push({
          rowNumber,
          entity: buildPersonEntity(
            mapped,
            lastPosition + positionOffset,
            companyId,
          ),
        });
        positionOffset++;
        continue;
      }

      if (conflictStrategy === 'skip') {
        summary.rows.push({
          row: rowNumber,
          status: 'skipped',
          email,
          message: 'Person with this email already exists',
        });
        summary.skipped++;
      } else if (conflictStrategy === 'create') {
        toCreate.push({
          rowNumber,
          entity: buildPersonEntity(
            mapped,
            lastPosition + positionOffset,
            companyId,
          ),
        });
        positionOffset++;
      } else {
        toUpdate.push({
          rowNumber,
          id: existing.id,
          data: buildPersonUpdate(mapped, companyId),
          email,
        });
      }
    }

    return { toCreate, toUpdate };
  }

  // ── Bulk DB operations ──────────────────────────────────────────────────

  /**
   * Inserts new persons in batches. If a batch fails, falls back to
   * row-by-row insertion to maximise successful imports.
   *
   * @param toCreate   - Array of `CreateEntry` objects to insert
   * @param personRepo - Workspace repository for Person entities
   * @param summary    - Import summary DTO to record results
   */
  private async bulkInsertPersons(
    toCreate: CreateEntry[],
    personRepo: WorkspaceRepository<PersonWorkspaceEntity>,
    summary: ImportSummaryDto,
  ): Promise<void> {
    for (let i = 0; i < toCreate.length; i += BATCH_SIZE) {
      const batch = toCreate.slice(i, i + BATCH_SIZE);

      try {
        await personRepo.insert(batch.map((b) => b.entity));
        this.recordCreatedRows(batch, summary);
      } catch {
        await this.insertRowsIndividually(batch, personRepo, summary);
      }
    }
  }

  /**
   * Records a batch of successfully created rows in the import summary.
   *
   * @param batch   - Array of `CreateEntry` objects that were inserted
   * @param summary - Import summary DTO to update
   */
  private recordCreatedRows(
    batch: CreateEntry[],
    summary: ImportSummaryDto,
  ): void {
    for (const { rowNumber, entity } of batch) {
      summary.rows.push({
        row: rowNumber,
        status: 'created',
        email: extractEntityEmail(entity),
      });
      summary.created++;
    }
  }

  /**
   * Fallback: inserts each row individually when a batch insert fails,
   * recording per-row success or error in the summary.
   *
   * @param batch      - Array of `CreateEntry` objects to retry individually
   * @param personRepo - Workspace repository for Person entities
   * @param summary    - Import summary DTO to record results
   */
  private async insertRowsIndividually(
    batch: CreateEntry[],
    personRepo: WorkspaceRepository<PersonWorkspaceEntity>,
    summary: ImportSummaryDto,
  ): Promise<void> {
    for (const { rowNumber, entity } of batch) {
      const email = extractEntityEmail(entity);

      try {
        await personRepo.insert(entity);
        summary.rows.push({ row: rowNumber, status: 'created', email });
        summary.created++;
      } catch (err) {
        summary.rows.push({
          row: rowNumber,
          status: 'error',
          email,
          message: err instanceof Error ? err.message : String(err),
        });
        summary.errors++;
      }
    }
  }

  /**
   * Updates existing person records one by one, recording each result
   * in the import summary.
   *
   * @param toUpdate   - Array of `UpdateEntry` objects to process
   * @param personRepo - Workspace repository for Person entities
   * @param summary    - Import summary DTO to record results
   */
  private async bulkUpdatePersons(
    toUpdate: UpdateEntry[],
    personRepo: WorkspaceRepository<PersonWorkspaceEntity>,
    summary: ImportSummaryDto,
  ): Promise<void> {
    for (const { rowNumber, id, data, email } of toUpdate) {
      try {
        await personRepo.update(id, data);
        summary.rows.push({ row: rowNumber, status: 'updated', email });
        summary.updated++;
      } catch (err) {
        summary.rows.push({
          row: rowNumber,
          status: 'error',
          email,
          message: err instanceof Error ? err.message : String(err),
        });
        summary.errors++;
      }
    }
  }

  // ── Company resolution ──────────────────────────────────────────────────

  /**
   * Resolves company names to their workspace UUIDs. Existing companies are
   * found by name; missing ones are created in batch. Returns a complete
   * `Map<companyName, companyId>` for all referenced companies.
   *
   * @param companyNames - Raw company name values from the CSV rows
   * @param companyRepo  - Workspace repository for Company entities
   * @returns A `Map<companyName, companyId>` covering every referenced company
   */
  private async resolveCompanies(
    companyNames: string[],
    companyRepo: WorkspaceRepository<CompanyWorkspaceEntity>,
  ): Promise<Map<string, string>> {
    const nameToId = new Map<string, string>();
    const uniqueNames = [
      ...new Set(
        companyNames
          .map((n) => extractPrimaryCompany(n))
          .filter((n) => n.length > 0),
      ),
    ];

    if (uniqueNames.length === 0) return nameToId;

    for (let i = 0; i < uniqueNames.length; i += BATCH_SIZE) {
      const batch = uniqueNames.slice(i, i + BATCH_SIZE);
      const existing = await companyRepo
        .createQueryBuilder('company')
        .where('company.name IN (:...names)', { names: batch })
        .getMany();

      for (const company of existing) {
        if (company.name) nameToId.set(company.name, company.id);
      }
    }

    const lastPos = (await companyRepo.maximum('position')) ?? 0;
    const toCreate = buildMissingCompanies(uniqueNames, nameToId, lastPos);

    for (let i = 0; i < toCreate.length; i += BATCH_SIZE) {
      await companyRepo.insert(toCreate.slice(i, i + BATCH_SIZE));
    }

    return nameToId;
  }
}
