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
      baseURL: config.get<string>('UNIPILE_BASE_URL', ''),
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



  async getAccountDetails(accountId: string) {
    try {
      const res = await this.http.get(`/accounts/${encodeURIComponent(accountId)}`);
      return res.data;
    } catch (err) {
      this.logger.error('UnipileService getAccountDetails error', err);
      // fallback: try user-scoped endpoint
      try {
        const res2 = await this.http.get('/users/account', { params: { account_id: accountId } });
        return res2.data;
      } catch (err2) {
        this.logger.error('UnipileService getAccountDetails fallback error', err2);
        throw err2;
      }
    }
  }

  async getUserProfile(accountId: string) {
    try {
      // Primero obtener el perfil del usuario
      const res = await this.http.get('/users/me', {
        params: { account_id: accountId }
      });
      return res.data;
    } catch (err) {
      this.logger.error('UnipileService getUserProfile error', err);
      throw err;
    }
  }

  async getAccountWithProfile(accountId: string) {
    try {
      // Obtener detalles básicos de la cuenta
      const accountDetails = await this.getAccountDetails(accountId);

      // Obtener perfil del usuario para obtener el nombre
      let userProfile = null;
      try {
        userProfile = await this.getUserProfile(accountId);
        console.log('userProfile ', userProfile);
      } catch (profileErr) {
        this.logger.warn('Could not fetch user profile, using account details only', profileErr);
      }

      // Combinar información
      return {
        ...accountDetails,
        // Intentar obtener el email desde diferentes fuentes
        email: accountDetails.connection_params?.mail?.username ||
               accountDetails.connection_params?.calendar?.username ||
               accountDetails.name ||
               userProfile?.email ||
               '',
        // Intentar obtener el nombre desde el perfil del usuario
        name: userProfile?.name ||
              userProfile?.display_name ||
              userProfile?.first_name && userProfile?.last_name
                ? `${userProfile.first_name} ${userProfile.last_name}`
                : '',
        firstName: userProfile?.given_name || '',
        lastName: userProfile?.surname || '',
        display_name: userProfile?.display_name || userProfile?.name || ''
      };
    } catch (err) {
      this.logger.error('UnipileService getAccountWithProfile error', err);
      throw err;
    }
  }


async getMicrosoftEmails(accountId: string, limit = 50, cursor?: string) {
  try {
    const params: any = { account_id: accountId, limit };
    if (cursor) params.cursor = cursor;
    const res = await this.http.get('/emails', { params });
    return res.data; // expected { items: Email[], cursor?: string }
  } catch (err: any) {
    this.logger.error('UnipileService getMicrosoftEmails error', err?.response?.data || err);
    // Propaga para que el caller decida; o devuelve vacío según preferencia
    throw err;
  }
}



  /**
 * Obtiene contactos de Microsoft Outlook usando Unipile API
 * @param {string} accountId - ID de cuenta Microsoft en Unipile
 * @param {number} limit - Límite de contactos por página
 * @param {string} [cursor] - Cursor de paginación
 * @returns {Promise<{items: any[], cursor?: string}>}
 */
async getMicrosoftContacts(accountId: string, limit = 50, cursor?: string) {
  try {
    // Primero obtener detalles de la cuenta para saber qué sources tiene
    const account = await this.getAccountDetails(accountId);
    this.logger.debug('Unipile account details', account);

    const params: any = { account_id: accountId, limit };
    if (cursor) params.cursor = cursor;

    // Buscar un source apto para contactos (heurística)
    const sources: any[] = account?.sources || [];
    const contactSource = sources.find((s) => /CONTACT|PEOPLE|CONTACTS/i.test(s.id || s.type || ''));

    if (contactSource) {
      params.source_id = contactSource.id;
      this.logger.debug('Using contact source_id', contactSource.id);
    } else {
      // Algunos accounts (como sólo MAILS) no exponen contactos via /users/contacts
      this.logger.warn(
        `Unipile account ${accountId} has no contact-capable source. Sources: ${JSON.stringify(
          sources,
        )}`,
      );
      // Devolver estructura vacía para que el flujo superior trate como "sin contactos"
      return { items: [], cursor: null };
    }

    // Hacer la petición con posible source_id
    const res = await this.http.get('/users/contacts', { params });
    console.log('getMicrosoftContacts res ', res.data);
    return res.data;
  } catch (err: any) {
    this.logger.error('UnipileService getMicrosoftContacts error', err?.response?.data || err);

    // Si Unipile devuelve 422 -> cuenta no diseñada para este feature
    if (err?.response?.status === 422) {
      try {
        const details = await this.getAccountDetails(accountId);
        this.logger.error('Unipile account details for debugging', details);
      } catch (detailErr) {
        this.logger.error('Failed to fetch Unipile account details', detailErr);
      }
      // Devolver vacío para que el caller no rompa el flujo
      return { items: [], cursor: null };
    }

    throw err;
  }
}
/**
 * Mapea contactos de Microsoft al formato estándar
 * Maneja tanto contactos de /users/contacts como emails de /emails
 * @param {any[]} contacts - Contactos crudos de Microsoft Outlook via Unipile
 * @returns {any[]} Contactos mapeados al formato común
 */
  mapMicrosoftContacts = (contacts: any[]) => {
    const seenEmails = new Set<string>();
    return contacts.reduce((uniqueContacts: any[], contact) => {
      // Get email from the contact
      let email = '';
      if (contact.from_attendee?.identifier_type === 'EMAIL_ADDRESS') {
        email = contact.from_attendee.identifier.toLowerCase().trim();
      } else if (contact.email) {
        email = contact.email.toLowerCase().trim();
      }

      if (!email || seenEmails.has(email)) {
        return uniqueContacts;
      }

      seenEmails.add(email);
      if (contact.email && contact.firstName !== undefined) {
        uniqueContacts.push({
          id: contact.id,
          firstName: contact.firstName || null,
          lastName: contact.lastName || null,
          publicProfileUrl: contact.publicProfileUrl || null,
          profilePictureUrl: contact.profilePictureUrl || null,
          headline: contact.headline || null,
          email: contact.email,
          phone: contact.phone || null,
          companyName: contact.companyName || null,
        });
        return uniqueContacts;
      }

      // Formato de /users/contacts (contactos reales)
      const currentDisplayName = contact.from_attendee?.display_name || '';
      const displayName = contact.display_name || '';
      const nameParts = displayName.split(' ');
      const firstName = contact.first_name || nameParts[0] || currentDisplayName || null;
      const lastName = contact.last_name || nameParts.slice(1).join(' ') || null;

      uniqueContacts.push({
        id: contact.id,
        firstName: firstName || currentDisplayName || null,
        lastName,
        publicProfileUrl: null,
        profilePictureUrl: null,
        headline: contact.job_title || null,
        email: email,
        phone: contact.phone_number || contact.mobile_phone || null,
        companyName: contact.company_name || null,
      });

      return uniqueContacts;
    }, []);
  };


  async getLinkedinConnections(accountId: string, limit = 50, cursor?: string) {
    this.logger.debug(
      `Attempting to connect with Unipile for account: ${accountId}${cursor ? ' with cursor: ' + cursor : ''}`,
    );

    // The correct endpoint according to Unipile docs is /users/relations
    const res = await this.http.get<{ items: any[]; cursor?: string }>(
      '/users/relations',
      {
        params: {
          account_id: accountId,
          role: 'CONNECTION', // Important for LinkedIn: brings your direct contacts
          limit: limit,
          ...(cursor &&
            cursor !== 'null' &&
            cursor !== 'undefined' && { cursor }),
        },
      },
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
  };

  /**
   * Detecta si un correo es automático/noreply basándose en patrones comunes
   * @param email - Dirección de correo electrónico
   * @param firstName - Nombre del contacto
   * @returns true si es un correo automático, false si es un contacto real
   */
  private isAutomatedEmail(email: string, firstName?: string | null): boolean {
    if (!email) return true;

    const emailLower = email.toLowerCase();
    const firstNameLower = (firstName || '').toLowerCase();

    // Patrones comunes en la parte local del email (antes del @)
    const automatedLocalPatterns = [
      /^(no-?reply|noreply|donotreply|donot-reply|do-not-reply|automated|auto|system|notification|notifications|alerts|alert|updates|update|mailer|mailing|marketing|newsletter|info|support|help|admin|administrator|service|services|team|teams|account|accounts|security|billing|payment|payments|invoice|invoices|receipt|receipts|order|orders|shipping|delivery|tracking|track|status|confirm|confirmation|verify|verification|welcome|unsubscribe|subscription|subscriptions|reminder|reminders|digest|summary|report|reports|feedback|survey|surveys|promo|promotion|promotions|offer|offers|deal|deals|sale|sales|discount|discounts|event|events|invite|invitation|invitations|calendar|meeting|meetings|webinar|webinars|training|learn|education|course|courses|tutorial|tutorials|guide|guides|tip|tips|blog|news|press|media|social|community|forum|forums|discussion|discussions|comment|comments|reply|replies|message|messages|chat|conversation|conversations|thread|threads|post|posts|share|shares|like|likes|follow|followers|following|friend|friends|connection|connections|contact|contacts|profile|profiles|settings|preferences|privacy|password|login|signin|signup|register|registration|activate|activation|reset|recovery|change|upgrade|downgrade|cancel|cancellation|refund|refunds|charge|charges|memories|admission|advertise)/i,
    ];

    // Dominios conocidos de servicios automáticos
    const automatedDomains = [
      'facebookmail.com',
      'accounts.google.com',
      'accountprotection.microsoft.com',
      'support.facebook.com',
      'correo.leroymerlin.es',
      'celimarcasas.es',
      'lsclondon.co.uk',
    ];

    // Extraer la parte local del email (antes del @)
    const [localPart] = emailLower.split('@');

    // Verificar patrones en la parte local del email
    for (const pattern of automatedLocalPatterns) {
      if (pattern.test(localPart)) {
        return true;
      }
    }

    // Verificar dominios automáticos
    for (const domain of automatedDomains) {
      if (emailLower.includes(domain)) {
        return true;
      }
    }

    // Verificar nombres comunes de servicios automáticos
    const automatedServiceNames = [
      'google',
      'facebook',
      'linkedin',
      'microsoft',
      'equipo de cuentas microsoft',
      'facebook ads team',
      'recuerdos de facebook',
      'mutua madrileña',
      'dgt',
      'dirección general de tráfico',
      'microsoft family safety',
      'admission',
    ];

    if (firstNameLower) {
      for (const serviceName of automatedServiceNames) {
        if (firstNameLower.includes(serviceName)) {
          return true;
        }
      }
    }

    return false;
  }

  mapContacts({ contacts, type }: { contacts: any[]; type: string }) {
    switch (type) {
      case 'LINKEDIN':
        return this.mapLinkedinConnections(contacts);
      case 'MICROSOFT':
      case 'OUTLOOK':
        return this.mapMicrosoftContacts(contacts);
      default:
        return [];
    }
  }


  /**
 * Obtiene contactos de cualquier provider (LinkedIn, Microsoft)
 * @param {string} provider - 'LINKEDIN' | 'MICROSOFT' | 'OUTLOOK'
 * @param {string} accountId - ID de cuenta en Unipile
 * @param {string} [cursor] - Cursor de paginación
 * @returns {Promise<any>} Contactos formateados del provider
 */
async getAccountContacts(
  provider: string,
  accountId: string,
  cursor?: string,
): Promise<any | null> {
  try {
    let contactRes;
    let providerType;

    switch (provider.toUpperCase()) {
      case 'LINKEDIN':
        contactRes = await this.getLinkedinConnections(accountId, 50, cursor);
        providerType = 'LINKEDIN';
        break;

      case 'MICROSOFT':
      case 'OUTLOOK':
      case 'EMAIL': // Para compatibilidad con tu LeadUser.source
        // Estrategia de fallback: primero intentar contactos reales, luego emails
        try {
          // 1. Intentar obtener contactos reales desde /users/contacts
          const contactsResult = await this.getMicrosoftContacts(accountId, 50, cursor);
          if (contactsResult.items && contactsResult.items.length > 0) {
            // ✅ Contactos reales encontrados, usar estos sin filtrado
            this.logger.debug(
              `Found ${contactsResult.items.length} real contacts for account ${accountId}`,
            );
            contactRes = contactsResult;
            providerType = 'MICROSOFT';
          } else {
            // 2. Fallback: usar emails si no hay contactos guardados
            this.logger.debug(
              `No real contacts found for account ${accountId}, falling back to emails`,
            );
            contactRes = await this.getMicrosoftEmails(accountId, 50, cursor);
            providerType = 'MICROSOFT';
            // Marcar que estos son emails (necesitarán filtrado)
            (contactRes as any).isFromEmails = true;
          }
        } catch (contactsError) {
          // Si getMicrosoftContacts falla, usar emails como fallback
          this.logger.warn(
            `Failed to get contacts for account ${accountId}, falling back to emails`,
            contactsError,
          );
          contactRes = await this.getMicrosoftEmails(accountId, 50, cursor);
          providerType = 'MICROSOFT';
          (contactRes as any).isFromEmails = true;
        }
        break;

      default:
        throw new Error(`Provider "${provider}" not supported`);
    }

    const mappedContacts = this.mapContacts({
      contacts: contactRes.items,
      type: providerType,
    });

    // Filtrar correos automáticos solo cuando se usan emails como fallback
    // Los contactos reales de /users/contacts no necesitan filtrado
    const filteredContacts =
      providerType === 'MICROSOFT' && (contactRes as any).isFromEmails
        ? mappedContacts.filter(
            (contact: any) =>
              !this.isAutomatedEmail(contact.email, contact.firstName),
          )
        : mappedContacts;

    return {
      contacts: filteredContacts,
      nextCursor: contactRes.cursor || null,
    };
  } catch (error) {
    this.logger.error(
      `Error fetching contacts for provider ${provider}`,
      error,
    );
    throw error;
  }
}

  async getLinkedinAccount(
    accountId: string,
    cursor?: string,
  ): Promise<any | null> {
    try {
      const contactRes = await this.getLinkedinConnections(
        accountId,
        50,
        cursor,
      );
      const mappedContacts = this.mapContacts({
        contacts: contactRes.items,
        type: 'LINKEDIN',
      });

      return {
        contacts: mappedContacts,
        nextCursor: contactRes.cursor || null,
      };
    } catch (error) {
      const err = error as AxiosError;
      console.log('getLinkedinAccount err ', err);
      if (err.response?.data) {
        this.logger.error(
          'Unipile Error Response Body:',
          JSON.stringify(err.response.data, null, 2),
        );
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
      const res = await this.http.post<{ account_id: string }>(
        '/accounts/checkpoint',
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
      this.logger.error(
        'UnipileService solveCodeCheckpoint failed',
        err.response?.data || err.message,
      );
      throw error;
    }
  }

  async disconnectAccount(accountId: string): Promise<boolean> {
    this.logger.log(`Starting account disconnection: ${accountId}`);

    try {
      // We use the DELETE method which is the standard for revoking/deleting resources
      await this.http.delete(`/accounts/${accountId}`);

      this.logger.debug(
        `Account ${accountId} successfully disconnected from Unipile.`,
      );
      return true;
    } catch (error) {
      const err = error as AxiosError;
      // If it no longer exists (404), for us it's as if it were disconnected
      if (err.response?.status === 404) {
        this.logger.warn(`Account ${accountId} no longer existed in Unipile.`);
        return true;
      }

      this.logger.error(
        `Error disconnecting account ${accountId}`,
        err.response?.data || err.message,
      );
      throw error;
    }
  }

  async getContactEmail(
    accountId: string,
    contact: MergeContactDto,
  ): Promise<
    | (MergeContactDto & {
        email: string;
        phone: string;
        profileUrl: string;
        lastCompany: any;
      })
    | null
  > {
    try {
      // This endpoint returns the complete profile.
      const res = await this.http.get<any>(`/users/${contact.id || contact}`, {
        params: { account_id: accountId, linkedin_sections: 'experience' },
      });
      const lastCompany = res.data?.work_experience?.[0] || null;
      return {
        email: res.data?.contact_info?.emails?.[0] || '',
        phone: res.data?.contact_info?.phones?.[0] || '',
        firstName: res.data?.first_name || null,
        lastName: res.data?.last_name || null,
        profilePictureUrl: res.data?.profile_picture_url || null,
        publicProfileUrl: res.data?.public_profile_url || null,
        profileUrl: res.data?.public_identifier
          ? `https://www.linkedin.com/in/${res.data?.public_identifier}/`
          : '',
        id: contact.id || '',
        lastCompany: lastCompany
          ? {
              name: lastCompany.company,
              position: lastCompany.position,
              location: lastCompany.location,
              description: lastCompany.description,
              startDate: lastCompany?.start || null,
              endDate: lastCompany?.end || null,
              companyPictureUrl: lastCompany.company_picture_url,
            }
          : null,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get details for ${contact.id || contact}`,
        error,
      );
      return null;
    }
  }
  async getContactDetail(
    accountId: string,
    contactId: string,
  ): Promise<any | null> {
    try {
      // This endpoint returns the complete profile.
      const res = await this.http.get<any>(`/users/${contactId}`, {
        params: {
          account_id: accountId,
          linkedin_sections: 'experience',
          force_update: true,
        },
      });

      const lastCompany = res.data?.work_experience?.[0] || null;

      console.log('res getContactDetail', res.data);

      return {
        email: res.data?.contact_info?.emails?.[0] || '',
        firstName: res.data?.first_name || null,
        lastName: res.data?.last_name || null,
        headline: res.data?.headline || null,
        profilePictureUrl: res.data?.profile_picture_url || null,
        publicProfileUrl: res.data?.public_profile_url || null,
        id: contactId || '',
        lastCompany: lastCompany
          ? {
              name: lastCompany.company,
              position: lastCompany.position,
              location: lastCompany.location,
              description: lastCompany.description,
              startDate: lastCompany?.start || null,
              endDate: lastCompany?.end || null,
            }
          : null,
      };
    } catch (error) {
      this.logger.error(`Failed to get details for ${contactId}`, error);
      return null;
    }
  }

  async generateHostedAuthLink(
    provider: 'MICROSOFT',
    userId: string,
    workspaceId: string,
    redirectUrl: string,
    reconnectAccountId?: string,
  ): Promise<{ url: string; expires_at: string } | string> {
    console.log('generateHostedAuthLink', provider, userId, redirectUrl, reconnectAccountId);
    const userAndWorkspaceInfo = `${userId}:${workspaceId}`;
    try {
      const res = await this.http.post('/hosted/accounts/link', {
        type: reconnectAccountId ? 'reconnect' : 'create',
        providers: ['OUTLOOK'], // Microsoft Outlook usa OUTLOOK
        api_url: 'https://api22.unipile.com:15273', // Tu servidor Unipile
        expiresOn: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 hora
        success_redirect_url: redirectUrl,
        failure_redirect_url: redirectUrl,
        notify_url: `https://7ad5-77-71-156-184.ngrok-free.app/webhooks/unipile`,
        name: userAndWorkspaceInfo,
        user_id: userAndWorkspaceInfo,
        features: ['contacts', 'mails'],  // Añadido 'mails' explícitamente
        scopes: 'User.Read Mail.Read Contacts.Read offline_access',  // Añadido más permisos
        ...(reconnectAccountId && { reconnect_account: reconnectAccountId }),
      });
      console.log('res generateHostedAuthLink', res.data);
      return res.data;
    } catch (error) {
      this.logger.error(`Failed to generate hosted auth link for ${userId}`, error);
      return "";
    }
  }



}
