export type ImportRowStatus = 'created' | 'updated' | 'skipped' | 'error';

export class ImportRowResult {
  row: number;
  status: ImportRowStatus;
  name?: string;
  email?: string;
  message?: string;
}

export class ImportSummaryDto {
  total: number;
  created: number;
  updated: number;
  skipped: number;
  errors: number;
  rows: ImportRowResult[];
}
