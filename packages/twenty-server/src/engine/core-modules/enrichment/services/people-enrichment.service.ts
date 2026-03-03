import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

import { FullEnrichWebhookData } from 'src/engine/core-modules/enrichment/dtos/fullenrich-webhook.dto';
import {
  EnrichmentProvider,
  EnrichmentStatus,
  PersonEnrichmentTrackingEntity,
} from 'src/engine/core-modules/enrichment/entities/person-enrichment-tracking.entity';
import { TwentyConfigService } from 'src/engine/core-modules/twenty-config/twenty-config.service';
import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import { buildSystemAuthContext } from 'src/engine/twenty-orm/utils/build-system-auth-context.util';
import { CompanyWorkspaceEntity } from 'src/modules/company/standard-objects/company.workspace-entity';
import { PersonJobHistoryWorkspaceEntity } from 'src/modules/person/standard-objects/person-job-history.workspace-entity';
import { PersonWorkspaceEntity } from 'src/modules/person/standard-objects/person.workspace-entity';
import { FullEnrichService, type FullEnrichContact } from 'src/services/fullenrich.service';

@Injectable()
export class PeopleEnrichmentService {
  private readonly logger = new Logger(PeopleEnrichmentService.name);

  constructor(
    @InjectRepository(PersonEnrichmentTrackingEntity)
    private readonly enrichmentTrackingRepository: Repository<PersonEnrichmentTrackingEntity>,
    private readonly globalWorkspaceOrmManager: GlobalWorkspaceOrmManager,
    private readonly fullEnrichService: FullEnrichService,
    private readonly twentyConfigService: TwentyConfigService,
  ) {}

  /**
   * Find people eligible for enrichment
   * Criteria: Have linkedinLink but haven't been enriched in last 30 days
   */
  async findPeopleToEnrich(
    workspaceId: string,
    batchSize: number = 50,
  ): Promise<PersonWorkspaceEntity[]> {
    // First, get IDs of people that should be excluded (have recent/active tracking)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    this.logger.log(
      `Finding people to enrich in workspace ${workspaceId}, checking tracking records...`,
    );

    // Query tracking table in core schema to get excluded person IDs
    const excludedTracking = await this.enrichmentTrackingRepository
      .createQueryBuilder('tracking')
      .select('tracking.personId')
      .where('tracking.workspaceId = :workspaceId', { workspaceId })
      .andWhere(
        `(
          tracking.status IN (:...activeStatuses)
          OR (tracking.status = :completedStatus AND tracking.lastEnrichedAt > :thirtyDaysAgo)
        )`,
        {
          activeStatuses: [
            EnrichmentStatus.PENDING,
            EnrichmentStatus.IN_PROGRESS,
          ],
          completedStatus: EnrichmentStatus.COMPLETED,
          thirtyDaysAgo,
        },
      )
      .getMany();

    const excludedPersonIds = excludedTracking.map((t) => t.personId);

    this.logger.log(
      `Found ${excludedPersonIds.length} people with recent/active tracking to exclude`,
    );

    // Now query workspace schema for people with LinkedIn
    const authContext = buildSystemAuthContext(workspaceId);

    return await this.globalWorkspaceOrmManager.executeInWorkspaceContext(
      authContext,
      async () => {
        const personRepository =
          await this.globalWorkspaceOrmManager.getRepository<PersonWorkspaceEntity>(
            workspaceId,
            PersonWorkspaceEntity,
            { shouldBypassPermissionChecks: true },
          );

        // Build query for people with LinkedIn
        const queryBuilder = personRepository
          .createQueryBuilder('person')
          .where('person.linkedinLinkPrimaryLinkUrl IS NOT NULL')
          .andWhere("person.linkedinLinkPrimaryLinkUrl != ''");

        // Exclude people with recent/active tracking
        if (excludedPersonIds.length > 0) {
          queryBuilder.andWhere('person.id NOT IN (:...excludedIds)', {
            excludedIds: excludedPersonIds,
          });
        }

        const people = await queryBuilder
          .orderBy('person.id', 'ASC')
          .limit(batchSize)
          .getMany();

        this.logger.log(
          `Found ${people.length} eligible people to enrich in workspace ${workspaceId}`,
        );

        return people;
      },
    );
  }

  /**
   * Create enrichment tracking records for people
   */
  async createEnrichmentTracking(
    workspaceId: string,
    peopleIds: string[],
  ): Promise<PersonEnrichmentTrackingEntity[]> {
    const trackingRecords = peopleIds.map((personId) => {
      return this.enrichmentTrackingRepository.create({
        workspaceId,
        personId,
        provider: EnrichmentProvider.FULL_ENRICH,
        status: EnrichmentStatus.PENDING,
      });
    });

    return await this.enrichmentTrackingRepository.save(trackingRecords);
  }

  /**
   * Process enrichment for a batch of people
   */
  async enrichPeople(
    workspaceId: string,
    trackingRecords: PersonEnrichmentTrackingEntity[],
  ): Promise<void> {
    if (trackingRecords.length === 0) return;

    // Mark as in progress
    await this.enrichmentTrackingRepository.update(
      { id: In(trackingRecords.map((t) => t.id)) },
      { status: EnrichmentStatus.IN_PROGRESS },
    );

    const authContext = buildSystemAuthContext(workspaceId);

    return await this.globalWorkspaceOrmManager.executeInWorkspaceContext(
      authContext,
      async () => {
        const personRepository =
          await this.globalWorkspaceOrmManager.getRepository<PersonWorkspaceEntity>(
            workspaceId,
            PersonWorkspaceEntity,
            { shouldBypassPermissionChecks: true },
          );

        try {
          // Collect all people data for bulk enrichment
          const enrichmentContacts: FullEnrichContact[] = [];
          const trackingMap = new Map<string, PersonEnrichmentTrackingEntity>();

          for (const tracking of trackingRecords) {
            const person = await personRepository.findOne({
              where: { id: tracking.personId },
            });

            if (
              !person ||
              !person.linkedinLink ||
              !person.linkedinLink.primaryLinkUrl
            ) {
              await this.enrichmentTrackingRepository.update(tracking.id, {
                status: EnrichmentStatus.FAILED,
                errorMessage: 'Person not found or no LinkedIn URL',
              });
              continue;
            }

            enrichmentContacts.push({
              linkedin_url: person.linkedinLink.primaryLinkUrl,
              first_name: person.name?.firstName,
              last_name: person.name?.lastName,
              enrich_fields: ['contact.emails', 'contact.phones'],
              custom: { personId: tracking.personId },
            });

            trackingMap.set(tracking.personId, tracking);
          }

          if (enrichmentContacts.length === 0) {
            return;
          }

          // Start bulk enrichment with webhook configuration
          const serverUrl = this.twentyConfigService.get('SERVER_URL');
          const webhookUrl = `${serverUrl}/webhooks/fullenrich/enrichment-completed`;

          this.logger.log(`Webhook URL configured: ${webhookUrl}`);

          const bulkResponse = await this.fullEnrichService.startEnrichBulk({
            name: `workspace_${workspaceId}_${Date.now()}`,
            data: enrichmentContacts,
            webhook_events: {
              contact_finished: webhookUrl,
            },
          });

          // Store enrichment_id in all tracking records
          const trackingIds = Array.from(trackingMap.values()).map((t) => t.id);
          await this.enrichmentTrackingRepository.update(
            { id: In(trackingIds) },
            {
              enrichmentData: {
                enrichment_id: bulkResponse.enrichment_id,
              } as any,
            },
          );

          this.logger.log(
            `Started bulk enrichment ${bulkResponse.enrichment_id} for ${enrichmentContacts.length} people in workspace ${workspaceId}`,
          );
        } catch (error) {
          this.logger.error(
            `Failed to start bulk enrichment for workspace ${workspaceId}:`,
            error,
          );

          // Mark all as failed
          await this.enrichmentTrackingRepository.update(
            { id: In(trackingRecords.map((t) => t.id)) },
            {
              status: EnrichmentStatus.FAILED,
              errorMessage: error.message,
            },
          );
        }
      },
    );
  }

  /**
   * Process completed enrichment data and update JobHistory
   */
  async processEnrichmentResults(workspaceId: string): Promise<void> {
    // Get in-progress enrichments with enrichment_id
    const pendingEnrichments = await this.enrichmentTrackingRepository.find({
      where: {
        workspaceId,
        status: EnrichmentStatus.IN_PROGRESS,
      },
      take: 100,
    });

    if (pendingEnrichments.length === 0) {
      return;
    }

    // Group by enrichment_id
    const enrichmentGroups = new Map<
      string,
      PersonEnrichmentTrackingEntity[]
    >();
    for (const tracking of pendingEnrichments) {
      const enrichmentId = tracking.enrichmentData?.enrichment_id;
      if (!enrichmentId) continue;

      if (!enrichmentGroups.has(enrichmentId)) {
        enrichmentGroups.set(enrichmentId, []);
      }
      enrichmentGroups.get(enrichmentId)!.push(tracking);
    }

    const authContext = buildSystemAuthContext(workspaceId);

    return await this.globalWorkspaceOrmManager.executeInWorkspaceContext(
      authContext,
      async () => {
        const personRepository =
          await this.globalWorkspaceOrmManager.getRepository<PersonWorkspaceEntity>(
            workspaceId,
            PersonWorkspaceEntity,
            { shouldBypassPermissionChecks: true },
          );

        const companyRepository =
          await this.globalWorkspaceOrmManager.getRepository<CompanyWorkspaceEntity>(
            workspaceId,
            CompanyWorkspaceEntity,
            { shouldBypassPermissionChecks: true },
          );

        const jobHistoryRepository =
          await this.globalWorkspaceOrmManager.getRepository<PersonJobHistoryWorkspaceEntity>(
            workspaceId,
            PersonJobHistoryWorkspaceEntity,
            { shouldBypassPermissionChecks: true },
          );

        // Process each enrichment batch
        for (const [enrichmentId, trackings] of enrichmentGroups.entries()) {
          try {
            // Get enrichment results from FullEnrich
            const enrichmentResult =
              await this.fullEnrichService.getEnrichResult(
                enrichmentId,
                true,
              );

            if (!enrichmentResult.data || enrichmentResult.data.length === 0) {
              continue;
            }

            // Process each enriched contact
            for (const contact of enrichmentResult.data) {
              const personId = contact.custom?.personId as string;
              if (!personId) continue;

              const tracking = trackings.find((t) => t.personId === personId);
              if (!tracking) continue;

              try {
                const person = await personRepository.findOne({
                  where: { id: personId },
                });

                if (!person) {
                  await this.enrichmentTrackingRepository.update(tracking.id, {
                    status: EnrichmentStatus.FAILED,
                    errorMessage: 'Person not found',
                  });
                  continue;
                }

                const jobTitle = contact.job_title;
                const companyName = contact.company_name;
                let companyId = person.companyId;

                // Find or create company
                if (companyName) {
                  const existingCompany = await companyRepository.findOne({
                    where: { name: companyName },
                  });

                  if (existingCompany) {
                    companyId = existingCompany.id;
                  } else {
                    const newCompany = companyRepository.create({
                      id: uuidv4(),
                      name: companyName,
                      linkedinLink: contact.linkedin_url
                        ? { primaryLinkUrl: contact.linkedin_url }
                        : null,
                    });
                    const savedCompany =
                      await companyRepository.save(newCompany);
                    companyId = savedCompany.id;
                  }
                }

                // Check if job changed
                const hasJobChange =
                  person.jobTitle !== jobTitle || person.companyId !== companyId;

                if (hasJobChange && (jobTitle || companyId)) {
                  // Mark previous job histories as not current
                  await jobHistoryRepository
                    .createQueryBuilder()
                    .update()
                    .set({ isCurrent: false })
                    .where('personId = :personId', { personId })
                    .andWhere('isCurrent = :isCurrent', { isCurrent: true })
                    .execute();

                  // Create new job history
                  const newJobHistory = jobHistoryRepository.create({
                    id: uuidv4(),
                    personId,
                    companyId,
                    jobTitle: jobTitle || null,
                    startDate: null,
                    endDate: null,
                    isCurrent: true,
                    source: 'full_enrich',
                  });

                  await jobHistoryRepository.save(newJobHistory);

                  // Update person
                  await personRepository.update(personId, {
                    jobTitle: jobTitle || person.jobTitle,
                    companyId: companyId || person.companyId,
                  });

                  this.logger.log(
                    `Updated job history for person ${personId} in workspace ${workspaceId}`,
                  );
                }

                // Mark tracking as completed
                await this.enrichmentTrackingRepository.update(tracking.id, {
                  status: EnrichmentStatus.COMPLETED,
                  lastEnrichedAt: new Date(),
                  enrichmentData: {
                    ...tracking.enrichmentData,
                    result: contact,
                  },
                });
              } catch (error) {
                this.logger.error(
                  `Failed to process contact for person ${personId}:`,
                  error,
                );
                await this.enrichmentTrackingRepository.update(tracking.id, {
                  status: EnrichmentStatus.FAILED,
                  errorMessage: error.message,
                });
              }
            }
          } catch (error) {
            this.logger.error(
              `Failed to get enrichment results for ${enrichmentId}:`,
              error,
            );
            // Mark all trackings in this batch as failed
            for (const tracking of trackings) {
              await this.enrichmentTrackingRepository.update(tracking.id, {
                status: EnrichmentStatus.FAILED,
                errorMessage: error.message,
              });
            }
          }
        }
      },
    );
  }

  /**
   * Process individual enrichment result from webhook
   */
  async processIndividualEnrichmentResult(
    personId: string,
    enrichmentId: string,
    contactData: FullEnrichWebhookData,
  ): Promise<void> {
    // Find tracking record by personId and enrichment_id
    const tracking = await this.enrichmentTrackingRepository.findOne({
      where: {
        personId,
        status: EnrichmentStatus.IN_PROGRESS,
      },
    });

    if (!tracking) {
      this.logger.warn(
        `No in-progress tracking found for person ${personId}`,
      );
      return;
    }

    // Verify enrichment_id matches
    if (tracking.enrichmentData?.enrichment_id !== enrichmentId) {
      this.logger.warn(
        `Enrichment ID mismatch for person ${personId}. Expected ${tracking.enrichmentData?.enrichment_id}, got ${enrichmentId}`,
      );
      return;
    }

    const authContext = buildSystemAuthContext(tracking.workspaceId);

    return await this.globalWorkspaceOrmManager.executeInWorkspaceContext(
      authContext,
      async () => {
        const personRepository =
          await this.globalWorkspaceOrmManager.getRepository<PersonWorkspaceEntity>(
            tracking.workspaceId,
            PersonWorkspaceEntity,
            { shouldBypassPermissionChecks: true },
          );

        const companyRepository =
          await this.globalWorkspaceOrmManager.getRepository<CompanyWorkspaceEntity>(
            tracking.workspaceId,
            CompanyWorkspaceEntity,
            { shouldBypassPermissionChecks: true },
          );

        const jobHistoryRepository =
          await this.globalWorkspaceOrmManager.getRepository<PersonJobHistoryWorkspaceEntity>(
            tracking.workspaceId,
            PersonJobHistoryWorkspaceEntity,
            { shouldBypassPermissionChecks: true },
          );

        try {
          const person = await personRepository.findOne({
            where: { id: personId },
          });

          if (!person) {
            await this.enrichmentTrackingRepository.update(tracking.id, {
              status: EnrichmentStatus.FAILED,
              errorMessage: 'Person not found',
            });
            return;
          }
          // Extract job information from webhook data
          const jobTitle = contactData.profile?.employment?.current?.title;
          const companyName = contactData.profile?.employment?.current?.company?.name;
          const startAt = contactData.profile?.employment?.current?.start_at
          let companyId = person.companyId;

          // Find or create company
          if (companyName) {
            const existingCompany = await companyRepository.findOne({
              where: { name: companyName },
            });

            if (existingCompany) {
              companyId = existingCompany.id;
            } else {
              const companyDomain = contactData.profile?.employment?.company_domain;
              const newCompany = companyRepository.create({
                id: uuidv4(),
                name: companyName,
                ...(companyDomain && {
                  domainName: { primaryLinkUrl: companyDomain },
                }),
              });
              const savedCompany = await companyRepository.save(newCompany);
              companyId = savedCompany.id;
            }
          }

          // Check if job changed
          const hasJobChange = person.companyId !== companyId;
          if (hasJobChange) {
            // Mark previous job histories as not current
            await jobHistoryRepository
              .createQueryBuilder()
              .update()
              .set({ isCurrent: false })
              .where('personId = :personId', { personId })
              .andWhere('isCurrent = :isCurrent', { isCurrent: true })
              .execute();

              const payload = {
                personId,
              companyId,
              jobTitle: jobTitle || null,
              startDate: startAt,
              endDate: null,
              isCurrent: true,
              source: 'full_enrich',
              }
              this.logger.log(
                `Creating new job history for person ${personId} with data: ${JSON.stringify(payload)}`,
              );
            // Create new job history
            const newJobHistory = jobHistoryRepository.create({
              id: uuidv4(),
              ...payload
            });

            await jobHistoryRepository.save(newJobHistory);

            // Update person
            await personRepository.update(personId, {
              jobTitle: jobTitle || person.jobTitle,
              companyId: companyId || person.companyId,
            });

            this.logger.log(
              `Updated job history for person ${personId} via webhook in workspace ${tracking.workspaceId}`,
            );
          }

          // Mark tracking as completed
          await this.enrichmentTrackingRepository.update(tracking.id, {
            status: EnrichmentStatus.COMPLETED,
            lastEnrichedAt: new Date(),
            enrichmentData: {
              ...tracking.enrichmentData,
              result: contactData,
            },
          });

          this.logger.log(
            `Successfully processed webhook enrichment for person ${personId}`,
          );
        } catch (error) {
          this.logger.error(
            `Failed to process webhook enrichment for person ${personId}:`,
            error,
          );
          await this.enrichmentTrackingRepository.update(tracking.id, {
            status: EnrichmentStatus.FAILED,
            errorMessage: error.message,
          });
        }
      },
    );
  }

  /**
   * Get enrichment status for a workspace
   */
  async getEnrichmentStats(workspaceId: string): Promise<{
    pending: number;
    inProgress: number;
    completed: number;
    failed: number;
  }> {
    const [pending, inProgress, completed, failed] = await Promise.all([
      this.enrichmentTrackingRepository.count({
        where: { workspaceId, status: EnrichmentStatus.PENDING },
      }),
      this.enrichmentTrackingRepository.count({
        where: { workspaceId, status: EnrichmentStatus.IN_PROGRESS },
      }),
      this.enrichmentTrackingRepository.count({
        where: { workspaceId, status: EnrichmentStatus.COMPLETED },
      }),
      this.enrichmentTrackingRepository.count({
        where: { workspaceId, status: EnrichmentStatus.FAILED },
      }),
    ]);

    return { pending, inProgress, completed, failed };
  }
}
