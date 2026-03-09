import { useCallback, useState } from 'react';
import { useRecoilValue } from 'recoil';

import { tokenPairState } from '@/auth/states/tokenPairState';
import {
    type ConflictStrategy,
    type ImportSummaryDto,
    uploadCsvForImport,
} from '~/services/people-import.service';

/** Upload lifecycle phase */
type UploadPhase = 'idle' | 'uploading' | 'done' | 'error';

/**
 * Custom hook that encapsulates the entire CSV import flow:
 * file selection → conflict strategy → upload → result display.
 *
 * Follows the same pattern as `useLinkedInContacts` for consistency.
 */
export function usePeopleImport() {
  const tokenPair = useRecoilValue(tokenPairState);

  const [file, setFile] = useState<File | null>(null);
  const [conflictStrategy, setConflictStrategy] =
    useState<ConflictStrategy>('merge');
  const [phase, setPhase] = useState<UploadPhase>('idle');
  const [summary, setSummary] = useState<ImportSummaryDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  /**
   * Triggers the CSV upload to the backend.
   * Transitions phase: idle → uploading → done | error.
   */
  const uploadFile = useCallback(async () => {
    if (!file) {
      setError('No file selected');

      return;
    }

    const token = tokenPair?.accessOrWorkspaceAgnosticToken?.token;

    if (!token) {
      setError('Authentication token not found — please log in again');

      return;
    }

    setPhase('uploading');
    setError(null);
    setSummary(null);

    try {
      const result = await uploadCsvForImport(token, file, conflictStrategy);

      setSummary(result);
      setPhase('done');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);

      setError(message);
      setPhase('error');
    }
  }, [file, tokenPair, conflictStrategy]);

  /**
   * Resets all state for a new import attempt.
   */
  const reset = useCallback(() => {
    setFile(null);
    setSummary(null);
    setError(null);
    setPhase('idle');
  }, []);

  return {
    file,
    setFile,
    conflictStrategy,
    setConflictStrategy,
    phase,
    summary,
    error,
    isUploading: phase === 'uploading',
    isDone: phase === 'done',
    uploadFile,
    reset,
  };
}
