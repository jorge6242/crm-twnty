import {
    type EmailsMetadata,
    type LinksMetadata,
    type PhonesMetadata,
} from 'twenty-shared/types';
import { v4 as uuidv4 } from 'uuid';

import { CompanyWorkspaceEntity } from 'src/modules/company/standard-objects/company.workspace-entity';
import { ImportSummaryDto } from 'src/modules/integrations/people-import/dto/people-import-result.dto';
import { PersonWorkspaceEntity } from 'src/modules/person/standard-objects/person.workspace-entity';

// ── Types ────────────────────────────────────────────────────────────────────

/** Raw key-value pair parsed from a single CSV row */
export type CsvRow = Record<string, string>;

/** A CSV row that passed validation (has a valid email) */
export type ValidRow = {
  rowNumber: number;
  mapped: Record<string, string>;
  email: string;
};

/** Payload for a new person to be inserted */
export type CreateEntry = {
  rowNumber: number;
  entity: Partial<PersonWorkspaceEntity>;
};

/** Payload for an existing person to be updated */
export type UpdateEntry = {
  rowNumber: number;
  id: string;
  data: Partial<PersonWorkspaceEntity>;
  email: string;
  name?: string;
};

// ── Constants ────────────────────────────────────────────────────────────────

/** Maximum number of records processed in a single DB batch operation */
export const BATCH_SIZE = 500;

/**
 * Canonical map that normalises heterogeneous CSV headers (English / Spanish)
 * into internal field names used by `mapRow`.
 *
 * @example
 * ```
 * COLUMN_ALIASES['nombre']      // → 'firstName'
 * COLUMN_ALIASES['correo']      // → 'email'
 * COLUMN_ALIASES['linkedin_url'] // → 'linkedinUrl'
 * ```
 */
export const COLUMN_ALIASES: Record<string, string> = {
  firstname: 'firstName',
  first_name: 'firstName',
  'first name': 'firstName',
  nombre: 'firstName',
  lastname: 'lastName',
  last_name: 'lastName',
  'last name': 'lastName',
  apellido: 'lastName',
  email: 'email',
  favoriteemail: 'email',
  'correo electronico': 'email',
  correo: 'email',
  mail: 'email',
  phone: 'phone',
  telefono: 'phone',
  mobile: 'phone',
  cel: 'phone',
  jobtitle: 'jobTitle',
  job_title: 'jobTitle',
  'job title': 'jobTitle',
  title: 'jobTitle',
  cargo: 'jobTitle',
  puesto: 'jobTitle',
  city: 'city',
  ciudad: 'city',
  linkedin: 'linkedinUrl',
  linkedinurl: 'linkedinUrl',
  linkedin_url: 'linkedinUrl',
  'linkedin url': 'linkedinUrl',
  company: 'companyName',
  companies: 'companyName',
  companyname: 'companyName',
  company_name: 'companyName',
  'company name': 'companyName',
  empresa: 'companyName',
};

// ── Summary helpers ──────────────────────────────────────────────────────────

/**
 * Creates an `ImportSummaryDto` representing a failed import with no valid rows.
 *
 * @param message - Human-readable reason for the failure
 * @returns An `ImportSummaryDto` with `total = 0` and one error row
 */
export function createEmptySummary(message: string): ImportSummaryDto {
  return {
    total: 0,
    created: 0,
    updated: 0,
    skipped: 0,
    errors: 1,
    rows: [{ row: 0, status: 'error', message }],
  };
}

/**
 * Initialises a fresh `ImportSummaryDto` with all counters at zero.
 *
 * @param total - Total number of data rows in the CSV (excluding headers)
 * @returns An empty `ImportSummaryDto` ready to be populated
 */
export function createSummary(total: number): ImportSummaryDto {
  return { total, created: 0, updated: 0, skipped: 0, errors: 0, rows: [] };
}

// ── CSV parsing ──────────────────────────────────────────────────────────────

/**
 * Normalises a raw CSV header string into an internal field name by
 * lower-casing, trimming, and resolving through `COLUMN_ALIASES`.
 *
 * @param header - The raw header string from the CSV file
 * @returns The normalised field name, or the lowered header if no alias exists
 */
export function normalizeHeader(header: string): string {
  const lower = header.toLowerCase().trim();

  return COLUMN_ALIASES[lower] ?? lower;
}

/**
 * Splits a single CSV line into an array of cell values, correctly handling
 * quoted fields and escaped double-quotes (`""`).
 *
 * @param line - A single line from the CSV content
 * @returns Array of unquoted cell values
 */
export function splitCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }

  result.push(current);

  return result;
}

/**
 * Parses a full CSV string (including header row) into an array of `CsvRow`
 * objects. Each row is keyed by the normalised header name.
 *
 * @param content - Raw CSV content as a UTF-8 string
 * @returns Array of `CsvRow` objects (empty if fewer than 2 non-empty lines)
 */
export function parseCsv(content: string): CsvRow[] {
  const lines = content
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n');
  const nonEmpty = lines.filter((l) => l.trim().length > 0);

  if (nonEmpty.length < 2) return [];

  const headers = splitCsvLine(nonEmpty[0]).map((h) => h.trim());
  const normalizedHeaders = headers.map((h) => normalizeHeader(h));

  return nonEmpty.slice(1).map((line) => {
    const values = splitCsvLine(line);
    const row: CsvRow = {};

    normalizedHeaders.forEach((key, idx) => {
      row[key] = (values[idx] ?? '').trim().replace(/^"|"$/g, '');
    });

    return row;
  });
}

// ── Row mapping ──────────────────────────────────────────────────────────────

/**
 * Extracts and normalises relevant fields from a raw `CsvRow` into a
 * flat key-value map used by entity builders.
 *
 * @param row - A single parsed CSV row
 * @returns A record with canonical field names and their string values
 */
export function mapRow(row: CsvRow): Record<string, string> {
  return {
    firstName: row['firstName'] ?? '',
    lastName: row['lastName'] ?? '',
    email: row['email'] ?? '',
    phone: row['phone'] ?? '',
    jobTitle: row['jobTitle'] ?? '',
    city: row['city'] ?? '',
    linkedinUrl: row['linkedinUrl'] ?? '',
    companyName: row['companyName'] ?? '',
  };
}

// ── Company helpers ──────────────────────────────────────────────────────────

/**
 * Extracts the first company name from a comma-separated list.
 *
 * @param companyField - Raw company field value (may be comma-separated)
 * @returns The trimmed name of the first company, or an empty string
 */
export function extractPrimaryCompany(companyField: string): string {
  return (companyField ?? '').split(',')[0].trim();
}

// ── Entity builders ──────────────────────────────────────────────────────────

/**
 * Builds a `Partial<PersonWorkspaceEntity>` ready for insertion from mapped
 * CSV data. Generates a new UUID and assigns the given position.
 *
 * @param mapped   - Normalised field map from `mapRow`
 * @param position - Numerical position in the workspace list
 * @param companyId - Optional UUID of the resolved company
 * @returns A partial entity suitable for `repository.insert()`
 */
export function buildPersonEntity(
  mapped: Record<string, string>,
  position: number,
  companyId?: string,
): Partial<PersonWorkspaceEntity> {
  type PhoneCC = PhonesMetadata['primaryPhoneCountryCode'];
  const phoneCountryCode = '' as PhoneCC;
  const entity: Partial<PersonWorkspaceEntity> = {
    id: uuidv4(),
    name: {
      firstName: mapped.firstName || '',
      lastName: mapped.lastName || '',
    },
    emails: {
      primaryEmail: mapped.email || '',
      additionalEmails: null,
    },
    phones: {
      primaryPhoneNumber: mapped.phone || '',
      primaryPhoneCountryCode: phoneCountryCode,
      primaryPhoneCallingCode: '',
      additionalPhones: null,
    },
    jobTitle: mapped.jobTitle || null,
    city: mapped.city || null,
    position,
  };

  if (mapped.linkedinUrl) {
    const linkLabel = '' as LinksMetadata['primaryLinkLabel'];

    entity.linkedinLink = {
      primaryLinkUrl: mapped.linkedinUrl,
      primaryLinkLabel: linkLabel,
      secondaryLinks: null,
    };
  }

  if (companyId) entity.companyId = companyId;

  return entity;
}

/**
 * Builds a `Partial<PersonWorkspaceEntity>` with only the fields that should
 * be overwritten during an update (merge) operation.
 *
 * @param mapped    - Normalised field map from `mapRow`
 * @param companyId - Optional UUID of the resolved company
 * @returns A partial entity suitable for `repository.update()`
 */
export function buildPersonUpdate(
  mapped: Record<string, string>,
  companyId?: string,
): Partial<PersonWorkspaceEntity> {
  const update: Partial<PersonWorkspaceEntity> = {};

  if (mapped.firstName || mapped.lastName) {
    update.name = {
      firstName: mapped.firstName || '',
      lastName: mapped.lastName || '',
    };
  }

  if (mapped.phone) {
    const phoneCountryCode =
      '' as PhonesMetadata['primaryPhoneCountryCode'];

    update.phones = {
      primaryPhoneNumber: mapped.phone,
      primaryPhoneCountryCode: phoneCountryCode,
      primaryPhoneCallingCode: '',
      additionalPhones: null,
    };
  }

  if (mapped.linkedinUrl) {
    const linkLabel = '' as LinksMetadata['primaryLinkLabel'];

    update.linkedinLink = {
      primaryLinkUrl: mapped.linkedinUrl,
      primaryLinkLabel: linkLabel,
      secondaryLinks: null,
    };
  }

  if (mapped.jobTitle) update.jobTitle = mapped.jobTitle;
  if (mapped.city) update.city = mapped.city;
  if (companyId) update.companyId = companyId;

  return update;
}

/**
 * Safely extracts the primary email from a partial `PersonWorkspaceEntity`.
 *
 * @param entity - Partial person entity that may or may not have emails set
 * @returns The primary email string, or an empty string if not set
 */
export function extractEntityEmail(
  entity: Partial<PersonWorkspaceEntity>,
): string {
  const emails = entity.emails as EmailsMetadata | undefined;

  return emails?.primaryEmail ?? '';
}

/**
 * Safely extracts the full name from a partial `PersonWorkspaceEntity`.
 *
 * @param entity - Partial person entity that may or may not have name set
 * @returns The full name string (firstName + lastName), or `undefined` if empty
 */
export function extractEntityName(
  entity: Partial<PersonWorkspaceEntity>,
): string | undefined {
  const nameField = entity.name as
    | { firstName?: string; lastName?: string }
    | undefined;
  const full = [nameField?.firstName, nameField?.lastName]
    .filter(Boolean)
    .join(' ');

  return full || undefined;
}

/**
 * Builds a list of `Partial<CompanyWorkspaceEntity>` for companies that do not
 * yet exist in the database. Generates new UUIDs and assigns sequential
 * positions starting after `lastPosition`.
 *
 * @param uniqueNames  - Deduplicated list of company names to resolve
 * @param nameToId     - Map that is mutated to include new entries
 * @param lastPosition - The current maximum position value in the company table
 * @returns Array of partial company entities ready for bulk insertion
 */
export function buildMissingCompanies(
  uniqueNames: string[],
  nameToId: Map<string, string>,
  lastPosition: number,
): Partial<CompanyWorkspaceEntity>[] {
  let offset = 0;
  const toCreate: Partial<CompanyWorkspaceEntity>[] = [];

  for (const name of uniqueNames) {
    if (!nameToId.has(name)) {
      const id = uuidv4();

      nameToId.set(name, id);
      toCreate.push({ id, name, position: lastPosition + offset });
      offset++;
    }
  }

  return toCreate;
}
