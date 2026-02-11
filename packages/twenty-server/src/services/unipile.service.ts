import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import https from 'https';

import axios, { AxiosError, AxiosInstance } from 'axios';
import { MergeContactDto } from 'src/modules/integrations/social-accounts/dto/merge-contact.dto';

export interface UnipileAccountResponse {
  id: string;
  provider: string;
  status: string;
}

@Injectable()
export class UnipileService {
  private readonly logger = new Logger(UnipileService.name);
  private readonly http: AxiosInstance;

  constructor(private readonly config: ConfigService) {
    this.http = axios.create({
        baseURL: config.get<string>('UNIPILE_BASE_URL',''),
        headers: {
          'X-API-KEY': config.get<string>('UNIPILE_API_KEY', ''),
          Accept: 'application/json',
        },
      timeout: 20000,
      httpsAgent: new https.Agent({
        keepAlive: true,
        timeout: 20000,
      }),
    });
  }

  async connectLinkedAccount(
    username: string,
    password: string,
    provider: string,
  ): Promise<UnipileAccountResponse> {
    const res = await this.http.post<UnipileAccountResponse>('/accounts', {
      username,
      password,
      provider,
    });

    return res.data;
  }

  // servidor (ejemplo)
async getLinkedinConnections(accountId: string, limit = 50, cursor?: string) {
  this.logger.debug(`Attempting to connect with Unipile for account: ${accountId}${cursor ? ' with cursor: ' + cursor : ''}`);

  // The correct endpoint according to Unipile docs is /users/relations
  const res = await this.http.get<{ items: any[]; cursor?: string }>(
    '/users/relations',
    {
      params: {
        account_id: accountId,
        role: 'CONNECTION', // Important for LinkedIn: brings your direct contacts
        limit: limit,
        ...(cursor && cursor !== 'null' && cursor !== 'undefined' && { cursor })
      }
    }
  );
  return res.data;
}

mapLinkedinConnections = (contacts: any[]) => {
  return contacts.map((contact) => {
    return {
      id: contact.member_id,
      firstName: contact.first_name,
      lastName: contact.last_name,
      publicProfileUrl: contact.public_profile_url,
      profilePictureUrl: contact.profile_picture_url,
      headline: contact.headline,
    };
  });
}

mapContacts({ contacts, type }: { contacts: any[], type: string }) {
  switch(type){
    case 'LINKEDIN':
      return this.mapLinkedinConnections(contacts);
    default:
      return [];
  }

}

  async getLinkedinAccount(
    accountId: string,
    cursor?: string
  ): Promise<any | null> {
    try {
      const contactRes = await this.getLinkedinConnections(accountId, 50, cursor);
      const mappedContacts = this.mapContacts({ contacts: contactRes.items, type: 'LINKEDIN' });

      return {
        contacts: mappedContacts,
        nextCursor: contactRes.cursor || null
      };
    } catch (error) {
      const err = error as AxiosError;
      console.log('getLinkedinAccount err ', err);
      if (err.response?.data) {
        this.logger.error('Unipile Error Response Body:', JSON.stringify(err.response.data, null, 2));
      }
      // If account not found, return null so callers can treat it as "not linked yet"
      if (err.response?.status === 404) {
        this.logger.warn(`Unipile account ${accountId} not found`);

        return null;
      }

      this.logger.error('UnipileService getLinkedinAccount error', err);
      throw error;
    }
  }

  async solveCodeCheckpoint(
    accountId: string,
    provider: string,
    code: string,
  ): Promise<{ account_id: string } | null> {
    try {
      const res = await this.http.post<{ account_id: string }>('/accounts/checkpoint',
        {
          account_id: accountId,
          provider: 'LINKEDIN',
          code,
        },
      );
      this.logger.debug('UnipileService solveCodeCheckpoint res', res.data);
      return res.data;
    } catch (error) {
      const err = error as AxiosError;
      this.logger.error('UnipileService solveCodeCheckpoint failed',err.response?.data || err.message);
      throw error;
    }
  }

  async disconnectAccount(accountId: string): Promise<boolean> {
    this.logger.log(`Starting account disconnection: ${accountId}`);

    try {
      // We use the DELETE method which is the standard for revoking/deleting resources
      await this.http.delete(`/accounts/${accountId}`);

      this.logger.debug(`Account ${accountId} successfully disconnected from Unipile.`);
      return true;
    } catch (error) {
      const err = error as AxiosError;
      // If it no longer exists (404), for us it's as if it were disconnected
      if (err.response?.status === 404) {
        this.logger.warn(`Account ${accountId} no longer existed in Unipile.`);
        return true;
      }

      this.logger.error(`Error disconnecting account ${accountId}`, err.response?.data || err.message);
      throw error;
    }
  }

  async getContactEmail(accountId: string, contact: MergeContactDto): Promise<MergeContactDto & { email: string, phone: string ,profileUrl: string ,lastCompany: any} | null> {
  try {
    // This endpoint returns the complete profile.
    const res = await this.http.get<any>(`/users/${contact.id || contact}`, {
      params: { account_id: accountId, linkedin_sections: 'experience' }
    });
    const lastCompany = res.data?.work_experience?.[0] || null;
    console.log('res getContactEmail', res.data)
    return {
      email: res.data?.contact_info?.emails?.[0] || "",
      phone: res.data?.contact_info?.phones?.[0] || "",
      firstName: res.data?.first_name || null,
      lastName: res.data?.last_name || null,
      profilePictureUrl: res.data?.profile_picture_url || null,
      publicProfileUrl: res.data?.public_profile_url || null,
      profileUrl: res.data?.public_identifier ? `https://www.linkedin.com/in/${res.data?.public_identifier}/` : "",
      id: contact.id || "",
      lastCompany: lastCompany ? {
        name: lastCompany.company,
        position: lastCompany.position,
        location: lastCompany.location,
        description: lastCompany.description,
        startDate: lastCompany?.start || null,
        endDate: lastCompany?.end || null,
        companyPictureUrl: lastCompany.company_picture_url,
      } : null,
    };
  } catch (error) {
    this.logger.error(`Failed to get details for ${contact.id || contact}`, error);
    return null;
  }
}
  async getContactDetail(accountId: string, contactId: string): Promise<any | null> {
  try {
    // This endpoint returns the complete profile.
    const res = await this.http.get<any>(`/users/${contactId}`, {
      params: { account_id: accountId, linkedin_sections: 'experience', force_update: true }
    });

    const lastCompany = res.data?.work_experience?.[0] || null;

    console.log('res getContactDetail', res.data)

    return {
      email: res.data?.contact_info?.emails?.[0] || "",
      firstName: res.data?.first_name || null,
      lastName: res.data?.last_name || null,
      headline: res.data?.headline || null,
      profilePictureUrl: res.data?.profile_picture_url || null,
      publicProfileUrl: res.data?.public_profile_url || null,
      id: contactId || "",
      lastCompany: lastCompany ? {
        name: lastCompany.company,
        position: lastCompany.position,
        location: lastCompany.location,
        description: lastCompany.description,
        startDate: lastCompany?.start || null,
        endDate: lastCompany?.end || null,
      } : null,
    };
  } catch (error) {
    this.logger.error(`Failed to get details for ${contactId}`, error);
    return null;
  }
}

}
