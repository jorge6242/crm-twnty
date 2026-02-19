import { BadRequestException, Injectable, Logger } from '@nestjs/common';
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
  private readonly logger = new Logger(SocialAccountsService.name);
  constructor(
    private readonly unipileService: UnipileService,
    @InjectRepository(LeadUserEntity)
    private readonly leadUserRepository: Repository<LeadUserEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
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

    const firstName =
      authUser?.firstName ?? authUser?.name?.split?.(' ')?.[0] ?? '';
    const lastName =
      authUser?.lastName ??
      (authUser?.name ? authUser.name.split(' ').slice(1).join(' ') : '') ??
      '';
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
      account_id: (saved as any)?.providerAccountId ?? null,
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
      where: { source: LeadSource.LINKEDIN, user: { id: user?.id } },
    });

    if (leadUserRes) {
      this.logger.log('Found lead user for provider ', provider, leadUserRes);
    } else {
      this.logger.log('No lead user found for provider ', provider);
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
      this.logger.error('Error checking contact presence in CRM:', error);
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
      let lead = await this.leadUserRepository.findOne({
        where: { providerAccountId: accountId },
      });

      if (!lead) {
        lead = await this.leadUserRepository.findOne({
          where: { source: LeadSource.LINKEDIN, user: { id: user.id } },
        });
      }
      if (lead) {
        lead.providerAccountId = returnedAccountId;
        await this.leadUserRepository.save(lead);
      }
    }
    return {
      message: 'Checkpoint solved',
      account_id: returnedAccountId,
    };
  }

async disconnectAccount(provider: string, user: UserEntity) {
  const sourceMap: Record<string, LeadSource> = {
    'linkedin': LeadSource.LINKEDIN,
    'email': LeadSource.EMAIL,
    'microsoft': LeadSource.EMAIL,
    'outlook': LeadSource.EMAIL,
    'whatsapp': LeadSource.WHATSAPP,
  };

  const leadSource = sourceMap[provider.toLowerCase()];
  if (!leadSource) {
    throw new BadRequestException(`Provider "${provider}" not supported`);
  }

  const leadUserRes = await this.leadUserRepository.findOne({
    where: { source: leadSource, user: { id: user.id } },
  });

  if (!leadUserRes) {
    throw new BadRequestException(`No ${provider} account found to disconnect`);
  }

  const accountId = leadUserRes.providerAccountId ?? '';
  const res = await this.unipileService.disconnectAccount(accountId);

  if (res) {
    await this.leadUserRepository.remove(leadUserRes);
  }

  return res;
}

  async mergeContactsToPeople(
    contacts: MergeContactDto[],
    authContext: WorkspaceAuthContext,
    provider: string
  ) {
    const { user, workspace } = authContext;
    const workspaceId = workspace.id;
    // Convertir provider string a LeadSource enum
    const sourceMap: Record<string, LeadSource> = {
      'linkedin': LeadSource.LINKEDIN,
      'email': LeadSource.EMAIL,
      'microsoft': LeadSource.EMAIL,
      'whatsapp': LeadSource.WHATSAPP,
    };

    const leadSource = sourceMap[provider.toLowerCase()];
    if (!leadSource) {
      throw new Error(`Unsupported provider: ${provider}`);
    }

    return this.globalWorkspaceOrmManager.executeInWorkspaceContext(
      authContext,
      async () => {
        try {
          const leadUserRes = await this.leadUserRepository.findOne({
            where: { source: leadSource, user: { id: user?.id } },
          });
          const accountId = leadUserRes?.providerAccountId ?? '';
          const newPeoples = [];
          const chunkSize = 5;

          for (let i = 0; i < contacts.length; i += chunkSize) {
            const chunk = contacts.slice(i, i + chunkSize);
            const chunkPromises = chunk.map((c) => this.unipileService.getContactEmail(accountId, c, provider));

            const enrichedChunk = await Promise.all(chunkPromises);
            newPeoples.push(...enrichedChunk);
            await new Promise((resolve) => setTimeout(resolve, 2000));
          }

          const uniqueCompaniesMap = new Map<string,Partial<CompanyWorkspaceEntity>>();
          newPeoples.forEach((p: any) => {
            if (p?.lastCompany?.name && !uniqueCompaniesMap.has(p.lastCompany.name)) {
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

          if(uniqueCompaniesMap.size > 0) {
            const companyRepository =
            await this.globalWorkspaceOrmManager.getRepository(
              workspaceId,
              CompanyWorkspaceEntity,
              { shouldBypassPermissionChecks: true },
            );

          const uniqueCompanyNames = Array.from(uniqueCompaniesMap.keys());
          const existingCompanies = await companyRepository.find({
            where: { name: In(uniqueCompanyNames) },
          });

          const existingCompaniesByName = new Map(
            existingCompanies.map((c) => [c.name, c]),
          );
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
                  primaryEmail: p.email
                    ? (p.email as string).toLowerCase()
                    : null,
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
                linkedinLink:
                  p.profileUrl || p.publicProfileUrl
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
            authContext,
          );

          console.log(
            'Merge completed successfully:',
            created.length,
            'people created.',
          );

          return {
            success: true,
            count: created.length,
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

  async generateMicrosoftAuthLink(
    userId: string,
    workspaceId: string,
    redirectUrl: string,
  ) {
    return this.unipileService.generateHostedAuthLink(
      'MICROSOFT',
      userId,
      workspaceId,
      redirectUrl,
    );
  }

  async handleAccountConnected(payload: {
    account_id: string;
    custom_id: string;
    name: string; // userId
    status: string;
    AccountStatus: {
      message: string;
    };
  }) {
    console.log('payload ', payload);
    if (payload.status !== 'CREATION_SUCCESS' || !payload.name) {
      console.log('Account connection not successful or missing user ID');
      return;
    }

    const userId = payload.name;
    const providerAccountId = payload.account_id;
    const [userIdFromPayload, workspaceId] = userId.split(':');
    console.log('Handling account connection for user:', userIdFromPayload, 'and workspace:', workspaceId);
    try {
      // Obtener el usuario con su workspace
      const user = await this.userRepository
        .createQueryBuilder('user')
        .leftJoinAndSelect('user.userWorkspaces', 'userWorkspace')
        .leftJoinAndSelect('userWorkspace.workspace', 'workspace')
        .where('user.id = :userId', { userId: userIdFromPayload })
        .getOne();

      if (!user || !user.userWorkspaces || user.userWorkspaces.length === 0) {
        throw new Error('User or workspace not found');
      }

      // Tomamos el primer workspace del usuario (o podrías tener lógica para elegir uno específico)


      // Verificar si ya existe un registro para este usuario y proveedor
      const existingLead = await this.leadUserRepository.findOne({
        where: {
          user: { id: userIdFromPayload },
          source: LeadSource.EMAIL,
        },
      });

      // Obtener detalles de la cuenta desde Unipile para extraer el email y nombre
      let accountEmail = '';
      let accountName = '';
      let firstName = '';
      let lastName = '';
      try {
        const accountDetails = await this.unipileService.getAccountWithProfile(providerAccountId);
        console.log('Account details from Unipile:', accountDetails);

        // Extraer email y nombre de los detalles de la cuenta
        accountEmail = accountDetails.email || '';
        accountName = accountDetails.name || accountDetails.display_name || '';
        firstName = accountDetails.firstName || '';
        lastName = accountDetails.lastName || '';

        // Si no tenemos firstName/lastName pero tenemos el nombre completo, separarlo
        if (!firstName && !lastName && accountName) {
          const nameParts = accountName.split(' ');
          firstName = nameParts[0] || '';
          lastName = nameParts.slice(1).join(' ') || '';
        }

        if (existingLead) {
          // Actualizar el registro existente
          existingLead.providerAccountId = providerAccountId;
          existingLead.email = accountEmail;
          existingLead.firstName = firstName;
          existingLead.lastName = lastName;
          existingLead.username = accountEmail;
          existingLead.updatedAt = new Date();
          await this.leadUserRepository.save(existingLead);
          console.log('Updated existing Microsoft account connection with email:', accountEmail, 'and name:', accountName);
        } else {
          // Crear un nuevo registro con la información real de la cuenta
          const newLead = this.leadUserRepository.create({
            source: LeadSource.EMAIL,
            providerAccountId,
            user: { id: userIdFromPayload },
            workspace: { id: workspaceId },
            firstName,
            lastName,
            username: accountEmail,
            email: accountEmail,
          });
          await this.leadUserRepository.save(newLead);
          console.log('Created new Microsoft account connection with email:', accountEmail, 'and name:', accountName);
        }
      } catch (error) {
        console.error('Error fetching account details from Unipile:', error);

        // Si no podemos obtener los detalles, crear/actualizar con valores vacíos
        if (existingLead) {
          existingLead.providerAccountId = providerAccountId;
          existingLead.updatedAt = new Date();
          await this.leadUserRepository.save(existingLead);
          console.log('Updated existing Microsoft account connection (no email retrieved)');
        } else {
          const newLead = this.leadUserRepository.create({
            source: LeadSource.EMAIL,
            providerAccountId,
            user: { id: userIdFromPayload },
            workspace: { id: workspaceId },
            firstName: '',
            lastName: '',
            username: '',
            email: '',
          });
          await this.leadUserRepository.save(newLead);
          console.log('Created new Microsoft account connection (no email retrieved)');
        }
      }
    } catch (error) {
      console.error('Error in handleAccountConnected:', error);
      throw new Error(`Failed to handle account connection: ${error.message}`);
    }
  }

  async getProviderContacts(
    provider: string,
    authContext: WorkspaceAuthContext,
    cursor?: string,
  ) {
    const { user, workspace } = authContext;
    const workspaceId = workspace.id;

    const sourceMap: Record<string, LeadSource> = {
      linkedin: LeadSource.LINKEDIN,
      email: LeadSource.EMAIL,
      microsoft: LeadSource.EMAIL,
      whatsapp: LeadSource.WHATSAPP,
      outlook: LeadSource.EMAIL,
    };
    const leadSource = sourceMap[provider.toLowerCase()];
    console.log('leadSource ', leadSource);
    if (!leadSource) {
      throw new BadRequestException(`Provider "${provider}" not supported`);
    }

    const leadUserRes = await this.leadUserRepository.findOne({
      where: {
        source: leadSource,
        user: { id: user?.id },
        workspace: { id: workspaceId },
      },
    });

    if (!leadUserRes?.providerAccountId) {
      console.log(`No lead user found for provider ${provider}`);
      return {
        account: null,
        contacts: [],
        nextCursor: null,
      };
    }

    console.log(`Found lead user for provider ${provider}:`, leadUserRes.id);

    const accountId = leadUserRes.providerAccountId;
    const cleanCursor =
      cursor === 'null' || cursor === 'undefined' ? undefined : cursor;

    const unipileRes = await this.unipileService.getAccountContacts(
      provider,
      accountId,
      cleanCursor,
    );

    if (!unipileRes?.contacts) {
      // ✅ Retorno consistente incluso si falla
      return {
        account: {
          id: leadUserRes.id,
          username: leadUserRes.username || leadUserRes.email,
          provider: leadUserRes.source,
        },
        contacts: [],
        nextCursor: null,
      };
    }

    // Marcar duplicados en CRM
    try {
      if (provider === 'linkedin') {
        await this.markLinkedInContactsInCrm(
          unipileRes,
          authContext,
          workspaceId,
        );
      } else if (
        ['email', 'microsoft', 'outlook'].includes(provider.toLowerCase())
      ) {
        await this.markMicrosoftContactsInCrm(
          unipileRes,
          authContext,
          workspaceId,
        );
      }
    } catch (error) {
      console.error('Error checking contact presence in CRM:', error);
    }

    // ✅ Retorno consistente siempre
    return {
      account: {
        id: leadUserRes.id,
        username: leadUserRes.username || leadUserRes.email,
        provider: leadUserRes.source,
      },
      contacts: unipileRes.contacts,
      nextCursor: unipileRes.nextCursor,
    };
  }

  /**
   * Marca contactos de Microsoft que ya existen en CRM por email
   */
  private async markMicrosoftContactsInCrm(
    unipileRes: any,
    authContext: WorkspaceAuthContext,
    workspaceId: string,
  ) {
    try {
      await this.globalWorkspaceOrmManager.executeInWorkspaceContext(
        authContext,
        async () => {
          const emails = unipileRes.contacts.map((c: any) => c.email).filter(Boolean);
          if (emails.length > 0) {
            const personRepository = await this.globalWorkspaceOrmManager.getRepository(
                workspaceId,
                PersonWorkspaceEntity,
                { shouldBypassPermissionChecks: true },
              );

            const existingPeople = await personRepository.createQueryBuilder('person').where("person.emailsPrimaryEmail IN (:...emails)", {emails,}).getMany();
            const existingEmailsSet = new Set(existingPeople.map((p: any) => p.emails?.primaryEmail?.toLowerCase()).filter(Boolean));

            unipileRes.contacts = unipileRes.contacts.map((contact: any) => ({
              ...contact,
              isAlreadyInCrm: contact.email
                ? existingEmailsSet.has(contact.email.toLowerCase())
                : false,
            }));
          }
        },
      );
    } catch (error) {
      console.error('Error checking Microsoft contacts in CRM:', error);
    }
  }

  /**
   * Marca contactos de LinkedIn que ya existen en CRM (por publicProfileUrl)
   */
  private async markLinkedInContactsInCrm(
    unipileRes: any,
    authContext: WorkspaceAuthContext,
    workspaceId: string,
  ) {
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
      console.error('Error checking LinkedIn contacts in CRM:', error);
    }
  }

  async initiateWhatsAppAuth(user: UserEntity, workspaceId: string) {
    try {
      const { qrCodeString, code } = await this.unipileService.connectWhatsApp();

      // Validar que recibimos un QR code válido
      if (!qrCodeString || qrCodeString.trim() === '') {
        throw new Error('No QR code received from Unipile');
      }

      console.log('QR Code received from Unipile:', qrCodeString?.substring(0, 50) + '...');
      console.log('Verification code received:', code);

      // Generar imagen QR a partir del string
      const QRCode = require('qrcode');
      const qrCodeUrl = await QRCode.toDataURL(qrCodeString);

      // Guardar el código de verificación para este usuario
      const existingLead = await this.leadUserRepository.findOne({
        where: {
          user: { id: user.id },
          source: LeadSource.WHATSAPP,
        },
      });

      if (existingLead) {
        // Actualizar el registro existente con el nuevo código de verificación
        existingLead.username = code;
        await this.leadUserRepository.save(existingLead);
      } else {
        // Crear un nuevo registro para WhatsApp
        const newLead = this.leadUserRepository.create({
          source: LeadSource.WHATSAPP,
          user: { id: user.id },
          workspace: { id: workspaceId },
          username: code,
          firstName: 'WhatsApp',
          lastName: 'Account',
          email: `${code}@whatsapp.local`,
          providerAccountId: code,
        });
        await this.leadUserRepository.save(newLead);
      }

      return {
        qrCodeUrl,
        verificationCode: code,
      };
    } catch (error) {
      console.error('Error initiating WhatsApp auth:', error);
      throw new Error('Error al generar el código QR de WhatsApp');
    }
  }

  async checkWhatsAppAuthStatus(verificationCode: string, user: UserEntity) {
    try {
      // Buscar el registro con el código de verificación
      const leadUser = await this.leadUserRepository.findOne({
        where: {
          user: { id: user.id },
          username: verificationCode,
          source: LeadSource.WHATSAPP,
        },
      });

      if (!leadUser) {
        throw new Error('Verification code not found');
      }

      // Verificar el estado con Unipile
      const check = await this.unipileService.checkWhatsAppAuthStatus(verificationCode);
      console.log('status ', check.status);
      if (check.status === 'OK') {
        // Actualizar el registro con el nombre real del teléfono
        if (check.name) {
          leadUser.username = check.name;
          await this.leadUserRepository.save(leadUser);
          console.log('Updated leadUser name:', check.name);
        }
        console.log('WhatsApp connected successfully for user:', user.id);
      }

      return check.status;
    } catch (error) {
      console.error('Error checking WhatsApp auth status:', error);
      throw new Error('Error al verificar el estado de autenticación');
    }
  }
}
