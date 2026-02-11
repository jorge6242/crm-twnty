import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { v4 as uuidv4 } from 'uuid';

import { In, Repository } from 'typeorm';

import { WorkspaceAuthContext } from 'src/engine/api/common/interfaces/workspace-auth-context.interface';
import {
  LeadSource,
  LeadUserEntity,
} from 'src/engine/core-modules/user/lead-user.entity';
import { UserEntity } from 'src/engine/core-modules/user/user.entity';
import {
  AddressMetadata,
  ConnectedAccountProvider,
  FieldActorSource,
  LinksMetadata,
} from 'twenty-shared/types';

import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import { CompanyWorkspaceEntity } from 'src/modules/company/standard-objects/company.workspace-entity';
import { CreatePersonService } from 'src/modules/contact-creation-manager/services/create-person.service';
import { MergeContactDto } from 'src/modules/integrations/social-accounts/dto/merge-contact.dto';
import { PersonWorkspaceEntity } from 'src/modules/person/standard-objects/person.workspace-entity';
import { UnipileService } from 'src/services/unipile.service';

@Injectable()
export class SocialAccountsService {
  constructor(
    private readonly unipileService: UnipileService,
    @InjectRepository(LeadUserEntity)
    private readonly leadUserRepository: Repository<LeadUserEntity>,
    private readonly createPersonService: CreatePersonService,
    private readonly globalWorkspaceOrmManager: GlobalWorkspaceOrmManager,
  ) {}

  getLeadUserAccounts(user: UserEntity): Promise<LeadUserEntity[]> {
    return this.leadUserRepository.find({
      where: { user: { id: user.id } },
    });
  }

  async linkAccount(
    username: string,
    password: string,
    authUser: any,
    workspaceId?: string,
  ): Promise<{ message: string; account_id?: string; lead?: LeadUserEntity }> {
    const response = await this.unipileService.connectLinkedAccount(
      username,
      password,
      'LINKEDIN',
    );

    const providerAccountId =
      (response as any)?.account_id ??
      (response as any)?.providerAccountId ??
      null;
    const accessToken = '';

    const firstName = authUser?.firstName ?? authUser?.name?.split?.(' ')?.[0] ?? '';
    const lastName = authUser?.lastName ?? (authUser?.name ? authUser.name.split(' ').slice(1).join(' ') : '') ?? '';
    const email = authUser?.email ?? `${username}@unknown.local`;

    if (!workspaceId) {
      throw new Error('Workspace id not found on authUser');
    }

    const leadPayload: Partial<LeadUserEntity> = {
      source: LeadSource.LINKEDIN,
      providerAccountId,
      username,
      accessToken,
      email,
      firstName,
      lastName,
    };


    if (authUser?.id) {
      (leadPayload as any).user = { id: authUser.id };
    }

    (leadPayload as any).workspace = { id: workspaceId };

    const lead = this.leadUserRepository.create(leadPayload as any);
    const saved = await this.leadUserRepository.save(lead);

    return {
      message: (response as any).message ?? 'Account linked successfully',
      account_id: (saved as any)?.providerAccountId ?? null
    };
  }

  async getLinkedinAccount(
    provider: string,
    authContext: WorkspaceAuthContext,
    cursor?: string,
  ) {
    const { user, workspace } = authContext;
    const workspaceId = workspace.id;

    const leadUserRes = await this.leadUserRepository.findOne({
      where: { source: LeadSource.LINKEDIN, user: { id: user.id } },
    });

    if (leadUserRes) {
      console.log('Found lead user for provider ', provider, leadUserRes);
    } else {
      console.log('No lead user found for provider ', provider);
    }
    const accountId = leadUserRes?.providerAccountId ?? '';
    const cleanCursor =
      cursor === 'null' || cursor === 'undefined' ? undefined : cursor;
    const unipileRes = await this.unipileService.getLinkedinAccount(
      accountId,
      cleanCursor,
    );

    if (!unipileRes || !unipileRes.contacts) {
      return unipileRes;
    }

    // Bulk lookup to check if contacts are already in CRM
    // Must be wrapped in workspace context
    try {
      await this.globalWorkspaceOrmManager.executeInWorkspaceContext(
        authContext,
        async () => {
          const profileUrls = unipileRes.contacts
            .map((c: any) => c.publicProfileUrl)
            .filter(Boolean);

          if (profileUrls.length > 0) {
            const personRepository =
              await this.globalWorkspaceOrmManager.getRepository(
                workspaceId,
                PersonWorkspaceEntity,
                { shouldBypassPermissionChecks: true },
              );

            const existingPeople = await personRepository.find({
              where: {
                linkedinLink: {
                  primaryLinkUrl: In(profileUrls),
                },
              } as any,
            });
            const existingUrlsMap = new Map(
              existingPeople.map((p) => [p.linkedinLink?.primaryLinkUrl, p.id]),
            );
            unipileRes.contacts = unipileRes.contacts.map((contact: any) => ({
              ...contact,
              isAlreadyInCrm: existingUrlsMap.has(contact.publicProfileUrl),
              personId: existingUrlsMap.get(contact.publicProfileUrl) || null,
            }));
          }
        },
      );
    } catch (error) {
      console.error('Error checking contact presence in CRM:', error);
      // We don't want to break the whole list if the lookup fails
    }

    return unipileRes;
  }

  async solveCheckpoint(provider: string, code: string, user: UserEntity) {
    const leadUserRes = await this.leadUserRepository.findOne({
      where: { source: LeadSource.LINKEDIN, user: { id: user.id } },
    });
    const accountId = leadUserRes?.providerAccountId ?? '';
    const res = await this.unipileService.solveCodeCheckpoint(
      accountId,
      provider,
      code,
    );
    // If Unipile returned an account_id, update our LeadUser record
    const returnedAccountId = (res as any)?.account_id ?? null;

    if (returnedAccountId) {
      // Try to find existing lead by providerAccountId or by user+source
      let lead = await this.leadUserRepository.findOne({ where: { providerAccountId: accountId } });

      if (!lead) { lead = await this.leadUserRepository.findOne({ where: { source: LeadSource.LINKEDIN, user: { id: user.id } },}); }
      if (lead) { lead.providerAccountId = returnedAccountId; await this.leadUserRepository.save(lead); }
    }
    return {
      message: 'Checkpoint solved',
      account_id: returnedAccountId,
    };
  }

  async disconnectAccount(provider: string, user: UserEntity) {
    const leadUserRes = await this.leadUserRepository.findOne({
      where: { source: LeadSource.LINKEDIN, user: { id: user.id } },
    });
    const accountId = leadUserRes?.providerAccountId ?? '';
    const res = await this.unipileService.disconnectAccount(accountId);
    if (res) {
      if (leadUserRes) {
        await this.leadUserRepository.remove(leadUserRes);
      }
    }
    return res;
  }

  async mergeContactsToPeople(
    contacts: MergeContactDto[],
    authContext: WorkspaceAuthContext,
  ) {
    const { user, workspace } = authContext;
    const workspaceId = workspace.id;
    console.log('Starting mergeContactsToPeople for workspace:', workspaceId);
    return this.globalWorkspaceOrmManager.executeInWorkspaceContext(
      authContext,
      async () => {
        try {
          const leadUserRes = await this.leadUserRepository.findOne({
            where: { source: LeadSource.LINKEDIN, user: { id: user?.id } },
          });
          const accountId = leadUserRes?.providerAccountId ?? '';
          const newPeoples = [];
          const chunkSize = 5;

          for (let i = 0; i < contacts.length; i += chunkSize) {
            const chunk = contacts.slice(i, i + chunkSize);
            const chunkPromises = chunk.map((c) =>
              this.unipileService.getContactEmail(accountId, c),
            );

            const enrichedChunk = await Promise.all(chunkPromises);
            newPeoples.push(...enrichedChunk);
            await new Promise((resolve) => setTimeout(resolve, 2000));
          }

          // ... (Rest of the mapping logic remains same, but wrapped in try-catch) ...
          // Using a shorter variable name for brevity in this specific replacement
          const uniqueCompaniesMap = new Map<string, Partial<CompanyWorkspaceEntity>>();
          newPeoples.forEach((p: any) => {
            if (p.lastCompany?.name && !uniqueCompaniesMap.has(p.lastCompany.name)) {
              uniqueCompaniesMap.set(p.lastCompany.name, {
                id: uuidv4(),
                name: p.lastCompany.name,
                address: {
                  addressStreet1: null as any,
                  addressStreet2: null as any,
                  addressCity: p.lastCompany.location || (null as any),
                  addressState: null as any,
                  addressZipCode: null as any,
                  addressCountry: null as any,
                  addressLat: null as any,
                  addressLng: null as any,
                } as AddressMetadata,
                domainName: {
                  primaryLinkUrl: null as any,
                  primaryLinkLabel: null as any,
                  secondaryLinks: null,
                } as LinksMetadata,
                linkedinLink: {
                  primaryLinkUrl: null as any,
                  primaryLinkLabel: null as any,
                  secondaryLinks: null,
                } as LinksMetadata,
              });
            }
          });

          const companyRepository = await this.globalWorkspaceOrmManager.getRepository(
            workspaceId,
            CompanyWorkspaceEntity,
            { shouldBypassPermissionChecks: true },
          );

          const uniqueCompanyNames = Array.from(uniqueCompaniesMap.keys());
          const existingCompanies = await companyRepository.find({
            where: { name: In(uniqueCompanyNames) }
          });

          const existingCompaniesByName = new Map(existingCompanies.map(c => [c.name, c]));
          const companiesToInsert: any[] = [];

          for (const [name, companyData] of uniqueCompaniesMap.entries()) {
            const existingCompany = existingCompaniesByName.get(name);
            if (existingCompany) {
              uniqueCompaniesMap.get(name)!.id = existingCompany.id;
            } else {
              companiesToInsert.push({
                ...companyData,
                createdBy: {
                  source: FieldActorSource.API,
                  workspaceMemberId: null,
                  name: 'Social Accounts Service',
                  context: { provider: ConnectedAccountProvider.LINKEDIN },
                },
                updatedBy: {
                  source: FieldActorSource.API,
                  workspaceMemberId: null,
                  name: 'Social Accounts Service',
                  context: { provider: ConnectedAccountProvider.LINKEDIN },
                },
              });
            }
          }

          if (companiesToInsert.length > 0) {
            await companyRepository.insert(companiesToInsert);
          }

          const peopleToCreate: Partial<PersonWorkspaceEntity>[] = newPeoples
            .filter((p: any) => p)
            .map((p: any) => {
              const firstName = p.firstName ?? '';
              const lastName = p.lastName ?? '';
              const companyId = p.lastCompany?.name ? uniqueCompaniesMap.get(p.lastCompany.name)?.id : null;
              return {
                id: uuidv4(),
                companyId: companyId,
                jobTitle: p.lastCompany?.position || null,
                emails: {
                  primaryEmail: p.email ? (p.email as string).toLowerCase() : null,
                  additionalEmails: null,
                },
                city: p.lastCompany?.location || null,
                phones: {
                  primaryPhoneNumber: p.phone || null,
                  primaryPhoneCountryCode: null as any,
                  primaryPhoneCallingCode: null as any,
                  additionalPhones: null as any,
                },
                name: {
                  firstName: firstName || null,
                  lastName: lastName || null,
                },
                linkedinLink: p.profileUrl || p.publicProfileUrl
                  ? ({
                      primaryLinkUrl: p.profileUrl || p.publicProfileUrl,
                      primaryLinkLabel: null,
                      secondaryLinks: null,
                    } as any)
                  : null,
                avatarUrl: p.profilePictureUrl ?? null,
              } as Partial<PersonWorkspaceEntity>;
            });

          const created = await this.createPersonService.createPeople(
            peopleToCreate,
            workspaceId,
          );

          console.log('Merge completed successfully:', created.length, 'people created.');

          return {
            success: true,
            count: created.length
          };
        } catch (error) {
          console.error('ERROR DETECTADO EN mergeContactsToPeople:', error);
          if (error instanceof Error) {
            console.error('Error Stack:', error.stack);
          }
          throw error;
        }
      },
    );
}


  async getContactDetail(contactId: string, user: UserEntity) {
    const leadUserRes = await this.leadUserRepository.findOne({
      where: { source: LeadSource.LINKEDIN, user: { id: user.id } },
    });

    if (leadUserRes) {
      console.log('Found lead user for provider ', leadUserRes);
    } else {
      console.log('No lead user found for provider ');
    }
    const accountId = leadUserRes?.providerAccountId ?? '';
    return this.unipileService.getContactDetail(accountId, contactId);
  }

}
