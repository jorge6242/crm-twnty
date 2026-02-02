import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { v4 as uuidv4 } from 'uuid';

import { Repository } from 'typeorm';

import {
  LeadSource,
  LeadUserEntity,
} from 'src/engine/core-modules/user/lead-user.entity';
import { UserEntity } from 'src/engine/core-modules/user/user.entity';
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

  async getLinkedinAccount(provider: string, user: UserEntity) {
    const leadUserRes = await this.leadUserRepository.findOne({
      where: { source: LeadSource.LINKEDIN, user: { id: user.id } },
    });

    if (leadUserRes) {
      console.log('Found lead user for provider ', provider, leadUserRes);
    } else {
      console.log('No lead user found for provider ', provider);
    }
    const accountId = leadUserRes?.providerAccountId ?? '';
    return this.unipileService.getLinkedinAccount(accountId);
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
    user: UserEntity,
    workspaceId: string,
  ) {
    const leadUserRes = await this.leadUserRepository.findOne({
      where: { source: LeadSource.LINKEDIN, user: { id: user.id } },
    });
    const accountId = leadUserRes?.providerAccountId ?? '';
    const newPeoples = [];
    const chunkSize = 5;

    for (let i = 0; i < contacts.length; i += chunkSize) {
      const chunk = contacts.slice(i, i + chunkSize);
      ``;
      const chunkPromises = chunk.map((c) =>
        this.unipileService.getContactEmail(accountId, c),
      );

      const enrichedChunk = await Promise.all(chunkPromises);
      newPeoples.push(...enrichedChunk);
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
    const peopleToCreate: Partial<PersonWorkspaceEntity>[] = newPeoples
      .filter((p: any) => p)
      .map((p: any) => {
        const firstName = p.firstName ?? '';
        const lastName = p.lastName ?? '';

        return {
          id: uuidv4(),
          emails: {
            primaryEmail: p.email ? (p.email as string).toLowerCase() : null,
            additionalEmails: null,
          },
          name: {
            firstName: firstName || null,
            lastName: lastName || null,
          },
          linkedinLink: p.publicProfileUrl
            ? ({
                primaryLinkUrl: p.publicProfileUrl,
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
    return { enriched: newPeoples, created };
  }
}
