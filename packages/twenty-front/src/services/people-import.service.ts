import { REACT_APP_SERVER_BASE_URL } from '~/config';

// ── Types ────────────────────────────────────────────────────────────────────

/** Status of a single imported row */
export type ImportRowStatus = 'created' | 'updated' | 'skipped' | 'error';

/** Result for one CSV row after import processing */
export interface ImportRowResult {
  row: number;
  status: ImportRowStatus;
  name?: string;
  email?: string;
  message?: string;
}

/** Aggregated import result returned by the backend */
export interface ImportSummaryDto {
  total: number;
  created: number;
  updated: number;
  skipped: number;
  errors: number;
  rows: ImportRowResult[];
}

/** Conflict resolution strategy for duplicate emails */
export type ConflictStrategy = 'merge' | 'skip' | 'create';

// ── API ──────────────────────────────────────────────────────────────────────

/**
 * Uploads a CSV file to the people-import backend endpoint.
 * Uses raw `fetch` with `FormData` because Apollo REST links
 * do not support multipart file uploads.
 *
 * @param token            - JWT access token for authorisation
 * @param file             - The CSV `File` selected by the user
 * @param conflictStrategy - How to handle rows whose email already exists
 * @returns The `ImportSummaryDto` with per-row results and counters
 * @throws Error if the network request fails or the response is not OK
 */
export async function uploadCsvForImport(
  token: string,
  file: File,
  conflictStrategy: ConflictStrategy,
): Promise<ImportSummaryDto> {
  const formData = new FormData();

  formData.append('file', file);

  const url = `${REACT_APP_SERVER_BASE_URL}/rest/metadata/people-import/csv?conflictStrategy=${conflictStrategy}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();

    throw new Error(
      `Import failed (${response.status}): ${errorText || response.statusText}`,
    );
  }

  return response.json() as Promise<ImportSummaryDto>;
}
