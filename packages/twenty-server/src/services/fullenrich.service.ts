import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosError, AxiosInstance } from 'axios';
import https from 'https';

// ─── Types ──────────────────────────────────────────────────────────────────

export type FullEnrichField =
  | 'contact.emails'
  | 'contact.personal_emails'
  | 'contact.phones';

export interface FullEnrichContact {
  first_name?: string;
  last_name?: string;
  domain?: string;
  company_name?: string;
  linkedin_url?: string;
  email?: string;
  enrich_fields?: FullEnrichField[];
  custom?: Record<string, string | number>;
}

export interface FullEnrichBulkPayload {
  name: string;
  data: FullEnrichContact[];
  webhook_url?: string;
  webhook_events?: string[];
}

export interface FullEnrichBulkResponse {
  enrichment_id: string;
}

export interface FullEnrichResultContact {
  first_name: string | null;
  last_name: string | null;
  emails: { value: string; type: string }[];
  phones: { value: string; type: string }[];
  linkedin_url: string | null;
  company_name: string | null;
  job_title: string | null;
  custom?: Record<string, string | number>;
}

export interface FullEnrichResult {
  enrichment_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  data: FullEnrichResultContact[];
}

export interface FullEnrichPeopleSearchFilters {
  title?: string;
  country?: string;
  company?: string;
  industry?: string;
  [key: string]: string | undefined;
}

export interface FullEnrichPeopleSearchPayload {
  offset?: number;
  limit?: number;
  filter?: FullEnrichPeopleSearchFilters;
}

export interface FullEnrichCompanySearchPayload {
  offset?: number;
  limit?: number;
  filter?: Record<string, string | undefined>;
}

// ─── Service ─────────────────────────────────────────────────────────────────

@Injectable()
export class FullEnrichService {
  private readonly logger = new Logger(FullEnrichService.name);
  private readonly http: AxiosInstance;

  constructor(private readonly config: ConfigService) {
    const apiKey = config.get<string>('FULLENRICH_API_KEY', '');

    this.http = axios.create({
      baseURL: config.get<string>('FULLENRICH_BASE_URL', ''),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      timeout: 30000,
      httpsAgent: new https.Agent({
        keepAlive: true,
        timeout: 30000,
      }),
    });
  }

  // ── Enrich ──────────────────────────────────────────────────────────────

  /**
   * Starts a bulk enrichment job (up to 100 contacts per request).
   * Returns an enrichment_id to poll or receive via webhook.
   */
  async startEnrichBulk(
    payload: FullEnrichBulkPayload,
  ): Promise<FullEnrichBulkResponse> {
    try {
      const res = await this.http.post<FullEnrichBulkResponse>(
        '/contact/enrich/bulk',
        payload,
      );

      this.logger.debug(
        `FullEnrich bulk enrich started: ${res.data.enrichment_id}`,
      );

      return res.data;
    } catch (error) {
      const err = error as AxiosError;

      this.logger.error(
        'FullEnrichService startEnrichBulk error',
        err.response?.data || err.message,
      );
      throw error;
    }
  }

  /**
   * Polls the result of a previously started bulk enrichment job.
   * @param forceResults When true, returns whatever has been found so far
   *                     even if the job is still IN_PROGRESS.
   */
  async getEnrichResult(enrichmentId: string, forceResults = false): Promise<FullEnrichResult> {
    try {
      const res = await this.http.get<FullEnrichResult>(
        `/contact/enrich/bulk/${encodeURIComponent(enrichmentId)}`,
        forceResults ? { params: { forceResults: true } } : undefined,
      );

      this.logger.debug(
        `FullEnrich result for ${enrichmentId}: status=${res.data.status} forceResults=${forceResults}`,
      );

      return res.data;
    } catch (error) {
      const err = error as AxiosError;

      this.logger.error(
        `FullEnrichService getEnrichResult error for ${enrichmentId}`,
        err.response?.data || err.message,
      );
      throw error;
    }
  }

  // ── Reverse Email ────────────────────────────────────────────────────────

  /**
   * Starts a bulk reverse email lookup job.
   * Returns an enrichment_id to poll or receive via webhook.
   */
  async startReverseEmailBulk(
    name: string,
    emails: Array<{ email: string; custom?: Record<string, string | number> }>,
    webhookUrl?: string,
  ): Promise<FullEnrichBulkResponse> {
    try {
      const payload: Record<string, unknown> = { name, data: emails };

      if (webhookUrl) {
        payload.webhook_url = webhookUrl;
      }

      const res = await this.http.post<FullEnrichBulkResponse>(
        '/contact/reverse/email/bulk',
        payload,
      );

      this.logger.debug(
        `FullEnrich reverse email bulk started: ${res.data.enrichment_id}`,
      );

      return res.data;
    } catch (error) {
      const err = error as AxiosError;

      this.logger.error(
        'FullEnrichService startReverseEmailBulk error',
        err.response?.data || err.message,
      );
      throw error;
    }
  }

  // ── Search ───────────────────────────────────────────────────────────────

  /**
   * Synchronous people search. Returns results immediately.
   */
  async searchPeople(
    payload: FullEnrichPeopleSearchPayload,
  ): Promise<{ data: FullEnrichResultContact[]; total: number }> {
    try {
      const res = await this.http.post<{
        data: FullEnrichResultContact[];
        total: number;
      }>('/people/search', payload);

      return res.data;
    } catch (error) {
      const err = error as AxiosError;

      this.logger.error(
        'FullEnrichService searchPeople error',
        err.response?.data || err.message,
      );
      throw error;
    }
  }

  /**
   * Synchronous company search. Returns results immediately.
   */
  async searchCompany(
    payload: FullEnrichCompanySearchPayload,
  ): Promise<{ data: unknown[]; total: number }> {
    try {
      const res = await this.http.post<{ data: unknown[]; total: number }>(
        '/company/search',
        payload,
      );

      return res.data;
    } catch (error) {
      const err = error as AxiosError;

      this.logger.error(
        'FullEnrichService searchCompany error',
        err.response?.data || err.message,
      );
      throw error;
    }
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  /**
   * Extracts the primary work email from a FullEnrich result contact.
   */
  getPrimaryEmail(contact: FullEnrichResultContact): string | null {
    const workEmail = contact.emails?.find((e) => e.type === 'work');
    const firstEmail = contact.emails?.[0];

    return workEmail?.value ?? firstEmail?.value ?? null;
  }

  /**
   * Extracts the primary mobile phone from a FullEnrich result contact.
   */
  getPrimaryPhone(contact: FullEnrichResultContact): string | null {
    const mobilePhone = contact.phones?.find((p) => p.type === 'mobile');
    const firstPhone = contact.phones?.[0];

    return mobilePhone?.value ?? firstPhone?.value ?? null;
  }
}
