import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosError, AxiosInstance } from 'axios';
import https from 'https';
import { MergeContactDto } from 'src/modules/integrations/social-accounts/dto/merge-contact.dto';
import { normalizePhone } from 'src/utils/phone';
import { v4 } from 'uuid';

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
      baseURL: `${config.get<string>('UNIPILE_BASE_URL', '')}/api/v1`,
      headers: {
        'X-API-KEY': config.get<string>('UNIPILE_API_KEY', ''),
        Accept: 'application/json',
      },
      timeout: 50000,
      httpsAgent: new https.Agent({
        keepAlive: true,
        timeout: 50000,
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

  async connectWhatsApp(): Promise<{ qrCodeString: string; code: string }> {
    try {
      // Try WhatsApp-specific endpoint first
      let res;
      try {
        res = await this.http.post<{ qr_code: string; account_id: string }>('/accounts/whatsapp', {
          provider: 'WHATSAPP',
        });
        this.logger.debug('Using WhatsApp-specific endpoint');
      } catch (whatsappError) {
        this.logger.debug('WhatsApp-specific endpoint failed, trying generic /accounts endpoint', whatsappError);
        res = await this.http.post<{ qr_code: string; account_id: string }>('/accounts', {
          provider: 'WHATSAPP',
        });
      }

      this.logger.debug('Unipile WhatsApp connect response:', JSON.stringify(res.data, null, 2));

      // Check for QR code in different possible locations
      let qrCodeField = res.data.qr_code || res.data.qrCode || res.data.qr;

      // Check nested structure (Checkpoint response)
      if (res.data.checkpoint && res.data.checkpoint.qrcode) {
        qrCodeField = res.data.checkpoint.qrcode;
      }

      const accountIdField = res.data.account_id || res.data.accountId || res.data.id;

      if (!qrCodeField) {
        this.logger.error('No QR code field found in WhatsApp connect response:', res.data);
        throw new Error('No QR code received from Unipile API');
      }

      return {
        qrCodeString: qrCodeField,
        code: accountIdField || 'unknown',
      };
    } catch (error) {
      this.logger.error('UnipileService connectWhatsApp error', error);
      throw error;
    }
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
   * Obtiene contactos de WhatsApp usando Unipile API
   * @param {string} accountId - ID de cuenta WhatsApp en Unipile
   * @param {number} limit - Limite de contactos por pagina
   * @param {string} [cursor] - Cursor de paginacion
   * @returns {Promise<{items: any[], cursor?: string}>}
   */
  async getWhatsAppContacts(accountId: string, limit = 50, cursor?: string) {
    try {
      const params: any = { account_id: accountId, limit };
      if (cursor) params.cursor = cursor;

      // Para WhatsApp, obtener los chats y luego extraer los attendees como contactos
      const chatsRes = await this.http.get('/chat_attendees', { params });
      this.logger.debug('WhatsApp chats response:', chatsRes.data);

      const contacts = [];
      const seenContacts = new Set();
      // Extraer attendees unicos de los chats
      if (chatsRes.data.items && Array.isArray(chatsRes.data.items)) {
        for (const chat of chatsRes.data.items) {
              const contactKey = chat.id;
              if (!seenContacts.has(contactKey)) {
                seenContacts.add(contactKey);
                contacts.push({
                  id: chat.id,
                  provider_id: chat.provider_id,
                  name: chat.name || 'Unknow name',
                  phone: chat?.specifics?.phone_number || '',
                  type: chat?.specifics?.provider || '',
                  email: null,
                });
              }
        }
      }
      return {
        items: contacts.slice(0, limit),
        cursor: chatsRes.data.cursor || null
      };
    } catch (err: any) {
      this.logger.error('UnipileService getWhatsAppContacts error', err?.response?.data || err);

      // Si Unipile devuelve 422 -> cuenta no disenada para este feature
      if (err?.response?.status === 422) {
        this.logger.warn(`WhatsApp account ${accountId} does not support contacts feature`);
        return { items: [], cursor: null };
      }

      throw err;
    }
  }

  /**
 * Helper para extraer emails de arrays de attendees de manera consistente
 * @param {any[]} attendees - Array de attendees (to, reply_to, cc, bcc)
 * @returns {string[]} Array de emails únicos en minúsculas
 */
private extractEmailsFromAttendees(attendees: any[]): string[] {
  if (!Array.isArray(attendees) || attendees.length === 0) {
    return [];
  }

  return attendees
    .filter(attendee => attendee?.identifier_type === 'EMAIL_ADDRESS' && attendee?.identifier && typeof attendee.identifier === 'string')
    .map(attendee => attendee.identifier.toLowerCase().trim())
    .filter(email => email && email.includes('@'));
}

/**
 * Filtra emails de sistema y no deseados
 * @param {string} email - Email a verificar
 * @returns {boolean} - True si el email es válido (no es de sistema)
 */
private isValidContactEmail(email: string): boolean {
  const systemEmailPatterns = [
    /noreply@/i,
    /no-reply@/i,
    /notification@/i,
    /donotreply@/i,
    /do-not-reply@/i,
    /updates@/i,
    /friendupdates@/i,
    /memories@/i,
    /advertise@/i,
    /messages-noreply@/i,
    /account-security@/i,
    /.*@facebookmail\.com$/i,
    /.*@accounts\.google\.com$/i,
    /.*@microsoft\.com$/i,
    /.*@linkedin\.com$/i,
    /.*@celimarcasas\.es$/i,
    /.*@correo\.leroymerlin\.es$/i,
    /.*@lsclondon\.co\.uk$/i
  ];

  return !systemEmailPatterns.some(pattern => pattern.test(email));
}

/**
 * Extrae nombre y apellido de un display name
 * @param {string} displayName - Nombre completo a parsear
 * @returns {object} - {firstName, lastName}
 */
private parseDisplayName(displayName: string): { firstName: string | null; lastName: string | null } {
  if (!displayName || typeof displayName !== 'string') {
    return { firstName: null, lastName: null };
  }

  // Si parece un email, no es un nombre válido
  if (displayName.includes('@')) {
    const mainEmail = displayName.split('@')?.[0];
    const splittedEmail = mainEmail.split('_') || mainEmail.split('.');
    return { firstName: splittedEmail?.[0] || null, lastName: splittedEmail?.[1] || null };
  }

  const parts = displayName.trim().split(" ");
  return {
    firstName: parts?.[0] || null,
    lastName: parts?.[1] || null,
  };
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
    const toEmails = this.extractEmailsFromAttendees(contact?.to_attendees || []);
    const replyToEmails = this.extractEmailsFromAttendees(contact?.reply_to_attendees || []);
    // const ccEmails = this.extractEmailsFromAttendees(contact?.cc_attendees || []);
    // const bccEmails = this.extractEmailsFromAttendees(contact?.bcc_attendees || []);

    const allEmails = [...toEmails, ...replyToEmails];
    const uniqueEmailsInThisContact = [...new Set(allEmails)];

    uniqueEmailsInThisContact.forEach(email => {
      if (!email || seenEmails.has(email) || !this.isValidContactEmail(email)) {
        return;
      }
      seenEmails.add(email);

      let contactFirstName = null;
      let contactLastName = null;

      const allAttendees = [ ...(contact?.to_attendees || []), ...(contact?.reply_to_attendees || []), ...(contact?.cc_attendees || []), ...(contact?.bcc_attendees || [])];

      const matchingAttendee = allAttendees.find(attendee => attendee?.identifier_type === 'EMAIL_ADDRESS' && attendee?.identifier?.toLowerCase() === email);
      const parsed = this.parseDisplayName(matchingAttendee?.display_name);
      contactFirstName = parsed.firstName;
      contactLastName = parsed.lastName;
      uniqueContacts.push({
        id: v4(), // ID único basado en email
        firstName: contactFirstName,
        lastName: contactLastName,
        publicProfileUrl: contact.publicProfileUrl || null,
        profilePictureUrl: contact.profilePictureUrl || null,
        headline: contact.headline || contact.job_title || null,
        email: email,
        phone: contact.phone || contact.phone_number || contact.mobile_phone || null,
        companyName: contact.companyName || contact.company_name || null,
      });
    });
    return uniqueContacts;
  }, []);
};

mapWhatsAppContacts(contacts: any[]) {
  return contacts.map(contact => {

    let firstName = null;
    let lastName = null;
    if(!contact.name.startsWith('+')) {
      const nameParts = contact.name.split(' ');
      firstName = nameParts[0] || '';
      lastName = nameParts.slice(1).join(' ') || null;
    }
    const cleanPhone = normalizePhone(contact.phone || '');
    const syntheticEmail = cleanPhone ? `${firstName}${lastName}_${cleanPhone}@whatsapp.local`.toLocaleLowerCase() : null;
    return {
    id: contact.id,
    firstName: firstName,
    lastName: lastName,
    publicProfileUrl: null,
    profilePictureUrl: null,
    headline: null,
    email: syntheticEmail,
    phone: contact.phone,
    companyName: null,
  }
  });
}

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
      case 'WHATSAPP':
        return this.mapWhatsAppContacts(contacts);
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
      case 'EMAIL':
        try {
          const contactsResult = await this.getMicrosoftContacts(accountId, 50, cursor);
          if (contactsResult.items && contactsResult.items.length > 0) {
            this.logger.debug(`Found ${contactsResult.items.length} real contacts for account ${accountId}`,);
            contactRes = contactsResult;
            providerType = 'MICROSOFT';
          } else {
            // 2. Fallback: usar emails si no hay contactos guardados
            this.logger.debug(`No real contacts found for account ${accountId}, falling back to emails`);
            contactRes = await this.getMicrosoftEmails(accountId, 50, cursor);
            providerType = 'MICROSOFT';
            // Marcar que estos son emails (necesitaran filtrado)
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

      case 'WHATSAPP':
        contactRes = await this.getWhatsAppContacts(accountId, 50, cursor);
        providerType = 'WHATSAPP';
        break;

      default:
        throw new Error(`Provider "${provider}" not supported`);
    }

    const mappedContacts = this.mapContacts({
      contacts: contactRes.items,
      type: providerType,
    });

    // Filtrar correos automaticos solo cuando se usan emails como fallback
    // Los contactos reales de /users/contacts no necesitan filtrado
    const filteredContacts = providerType === 'MICROSOFT' && (contactRes as any).isFromEmails ? mappedContacts.filter(
            (contact: any) => !this.isAutomatedEmail(contact.email, contact.firstName)) : mappedContacts;

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
    provider: string
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
      if(provider === 'email' || provider === 'whatsapp') {
        return {
          email: contact.email || '',
          phone: '',
          firstName: contact?.firstName || null,
          lastName: contact?.lastName || null,
          profilePictureUrl: "",
          publicProfileUrl: "",
          profileUrl: '',
          id: contact.id || '',
          lastCompany: null,
        };
      }
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
        profileUrl: res.data?.public_identifier ? `https://www.linkedin.com/in/${res.data?.public_identifier}/` : '',
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

      this.logger.verbose('res getContactDetail', res.data);

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

  async checkWhatsAppAuthStatus(verificationCode: string): Promise<{ status: string; name: string }> {
    try {
      // Check the account status using the verification code as account identifier
      const res = await this.http.get(`/accounts/${encodeURIComponent(verificationCode)}`);
      console.log('res?.data ', res?.data);
      console.log('res?.data?.sources ', res?.data?.sources);
      return { status: res.data?.sources?.[0]?.status || 'unknown', name: res.data?.name || '' };
    } catch (error) {
      this.logger.error('UnipileService checkWhatsAppAuthStatus error', error);
      // If account not found, return 'not_found' or similar
      if (error instanceof AxiosError && error.response?.status === 404) {
        return { status: 'not_found', name: '' };
      }

      throw error;
    }
  }

  async generateHostedAuthLink(
    provider: 'MICROSOFT',
    userId: string,
    workspaceId: string,
    redirectUrl: string,
    reconnectAccountId?: string,
  ): Promise<{ url: string; expires_at: string }> {
    this.logger.verbose('generateHostedAuthLink', provider, userId, redirectUrl, reconnectAccountId);
    const userAndWorkspaceInfo = `${userId}:${workspaceId}`;
    try {
      const requestBody = {
        type: reconnectAccountId ? 'reconnect' : 'create',
        providers: ['OUTLOOK'], // Microsoft Outlook usa OUTLOOK
        api_url: this.config.get<string>('UNIPILE_BASE_URL', ''), // Tu servidor Unipile
        client_id: 'f5b27453-3d1a-4c0d-b60d-0c51842135d0', // TU Application ID correcto
        expiresOn: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 hora
        success_redirect_url: redirectUrl,
        failure_redirect_url: redirectUrl,
        notify_url: `${this.config.get<string>('TEMPORAL_BACKEND_BASE_URL', '')}/webhooks/unipile`,
        name: userAndWorkspaceInfo,
        user_id: userAndWorkspaceInfo,
        features: ['contacts', 'mails'],  // Añadido 'mails' explícitamente
        scopes: 'User.Read Mail.Read Contacts.Read offline_access',  // Removido offline_access para evitar admin approval
        tenant_id: '479a58aa-145f-4e76-97a5-515e763b24f8', // Tu Tenant ID específico
        ...(reconnectAccountId && { reconnect_account: reconnectAccountId }),
      };
      this.logger.verbose('Request body being sent to Unipile:', JSON.stringify(requestBody, null, 2));
      const res = await this.http.post('/hosted/accounts/link', requestBody);
      this.logger.verbose('res generateHostedAuthLink', res.data);
      return res.data;
    } catch (error) {
      this.logger.error(`Failed to generate hosted auth link for ${userId}`, error);
      throw error;
    }
  }



}
