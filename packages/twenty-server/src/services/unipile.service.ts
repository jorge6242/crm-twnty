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
  this.logger.debug(`Intentando conectar con Unipile para la cuenta: ${accountId}`);

  // El endpoint correcto según la doc de Unipile es /users/relations
  return this.http.get<{ items: unknown[]; cursor?: string }>(
    '/users/relations',
    {
      params: {
        account_id: accountId,
        role: 'CONNECTION', // Importante para LinkedIn: trae tus contactos directos
        limit: limit,
        ...(cursor && { cursor })
      }
    }
  );
}

mapLinkedinConnections = (contacts: any[]) => {
  console.log('contacts ', contacts);
  return contacts.map((contact) => {
    return {
      id: contact.member_id,
      firstName: contact.first_name,
      lastName: contact.last_name,
      publicProfileUrl: contact.public_profile_url,
      profilePictureUrl: contact.profile_picture_url
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
  ): Promise<any | null> {
    console.log('UnipileService getLinkedinAccount flag');

    try {
      // const res = await this.http.get<UnipileAccountResponse>(`/accounts/${accountId}`);
      const contactRes = await this.getLinkedinConnections(accountId);
      const mappedContacts = this.mapContacts({ contacts: contactRes.data.items, type: 'LINKEDIN' });
      return mappedContacts;
    } catch (error) {
      const err = error as AxiosError;
      console.log('getLinkedinAccount err ', err)
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

  async getContactEmail(accountId: string, contact: MergeContactDto): Promise<MergeContactDto & { email: string } | null> {
  try {
    this.logger.debug(`Enriching profile to get email: ${contact.id || contact}`);
    // This endpoint returns the complete profile.
    const res = await this.http.get<any>(`/users/${contact.id || contact}`, {
      params: { account_id: accountId }
    });
    console.log('res getContactEmail', res)
    return {
      email: res.data?.contact_info?.emails?.[0] || "",
      firstName: res.data?.first_name || null,
      lastName: res.data?.last_name || null,
      profilePictureUrl: res.data?.profile_picture_url || null,
      publicProfileUrl: res.data?.public_profile_url || null,
      id: contact.id || "",
    };
  } catch (error) {
    this.logger.error(`Failed to get details for ${contact.id || contact}`, error);
    return null;
  }
}

}
