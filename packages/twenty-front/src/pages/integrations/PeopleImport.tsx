import { useCallback, useRef, useState } from 'react';

import { H3Title } from 'twenty-ui/display';
import { Button } from 'twenty-ui/input';

import { type ConflictStrategy } from '~/services/people-import.service';

import { usePeopleImport } from './hooks/usePeopleImport';
import * as S from './PeopleImport.styles';

/** Available conflict strategies with display labels */
const STRATEGIES: { value: ConflictStrategy; label: string; hint: string }[] = [
  {
    value: 'merge',
    label: 'Merge',
    hint: 'Update existing records with new data',
  },
  {
    value: 'skip',
    label: 'Skip',
    hint: 'Keep existing records unchanged',
  },
  {
    value: 'create',
    label: 'Create',
    hint: 'Always create a new record',
  },
];

/** Status filter options for the result table */
const STATUS_FILTERS = ['all', 'created', 'updated', 'skipped', 'error'] as const;

/**
 * Page component for CSV contact import.
 *
 * Provides a drop zone for file selection, conflict strategy selector,
 * and a results table with row-level detail and color-coded status badges.
 */
export const PeopleImport = () => {
  const {
    file,
    setFile,
    conflictStrategy,
    setConflictStrategy,
    summary,
    error,
    isUploading,
    isDone,
    uploadFile,
    reset,
  } = usePeopleImport();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  /** Handles file selection from input or drop */
  const handleFileChange = useCallback(
    (selectedFile: File | null) => {
      if (selectedFile && selectedFile.name.endsWith('.csv')) {
        setFile(selectedFile);
      }
    },
    [setFile],
  );

  /** Drag-and-drop event handlers */
  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(true);
    },
    [],
  );

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const droppedFile = e.dataTransfer.files[0];

      handleFileChange(droppedFile ?? null);
    },
    [handleFileChange],
  );

  /** Filtered result rows based on user-selected status */
  const filteredRows =
    summary?.rows.filter(
      (r) => statusFilter === 'all' || r.status === statusFilter,
    ) ?? [];

  return (
    <S.StyledContainer>
      <S.StyledCardWrapper>
        <H3Title title="Import contacts from CSV" />
        <S.Description>
          Upload a CSV file with contact data. The file must include an
          &quot;email&quot; column. Supported columns: name, phone, job title,
          city, LinkedIn URL, and company.
        </S.Description>

        {/* ── Drop Zone ──────────────────────────────────────────── */}
        {!isDone && (
          <S.DropZone
            $isDragging={isDragging}
            $hasFile={!!file}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            htmlFor="csv-file-input"
          >
            <S.HiddenInput
              id="csv-file-input"
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={(e) =>
                handleFileChange(e.target.files?.[0] ?? null)
              }
            />
            {file ? (
              <S.FileName>{file.name}</S.FileName>
            ) : (
              <S.DropZoneText>
                Drag &amp; drop a CSV file here, or click to browse
              </S.DropZoneText>
            )}
          </S.DropZone>
        )}

        {/* ── Action Buttons ─────────────────────────────────────── */}
        <S.ActionBar>
          {!isDone ? (
            <Button
              title={isUploading ? 'Importing…' : 'Import'}
              onClick={uploadFile}
              disabled={!file || isUploading}
              isLoading={isUploading}
            />
          ) : (
            <Button title="New Import" onClick={reset} />
          )}
        </S.ActionBar>

        {/* ── Error Message ──────────────────────────────────────── */}
        {error && <S.ErrorMessage>{error}</S.ErrorMessage>}

        {/* ── Summary Counters ───────────────────────────────────── */}
        {summary && (
          <>
            <S.SummaryBar>
              <S.Counter>
                <S.CounterValue>{summary.total}</S.CounterValue>
                <S.CounterLabel>Total</S.CounterLabel>
              </S.Counter>
              <S.Counter>
                <S.CounterValue $color="#4ade80">
                  {summary.created}
                </S.CounterValue>
                <S.CounterLabel>Created</S.CounterLabel>
              </S.Counter>
              <S.Counter>
                <S.CounterValue $color="#60a5fa">
                  {summary.updated}
                </S.CounterValue>
                <S.CounterLabel>Updated</S.CounterLabel>
              </S.Counter>
              <S.Counter>
                <S.CounterValue $color="#f87171">
                  {summary.errors}
                </S.CounterValue>
                <S.CounterLabel>Errors</S.CounterLabel>
              </S.Counter>
            </S.SummaryBar>

            {/* ── Filter Bar ─────────────────────────────────────── */}
            <S.FilterBar>
              <S.StrategyLabel>Filter:</S.StrategyLabel>
              {STATUS_FILTERS.map((f) => (
                <S.StrategyButton
                  key={f}
                  $active={statusFilter === f}
                  onClick={() => setStatusFilter(f)}
                >
                  {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
                </S.StrategyButton>
              ))}
            </S.FilterBar>

            {/* ── Results Table ───────────────────────────────────── */}
            <S.ResultTable>
              <S.ResultRowHeader>
                <S.ResultCell>Row</S.ResultCell>
                <S.ResultCell>Name</S.ResultCell>
                <S.ResultCell>Email</S.ResultCell>
                <S.ResultCell>Status</S.ResultCell>
                <S.ResultCell>Message</S.ResultCell>
              </S.ResultRowHeader>

              {filteredRows.map((row) => (
                <S.ResultRow key={`${row.row}-${row.email}`}>
                  <S.ResultCell>{row.row}</S.ResultCell>
                  <S.ResultCell>{row.name ?? '—'}</S.ResultCell>
                  <S.ResultCell>{row.email ?? '—'}</S.ResultCell>
                  <S.ResultCell>
                    <S.StatusBadge $status={row.status}>
                      {row.status}
                    </S.StatusBadge>
                  </S.ResultCell>
                  <S.ResultCell>{row.message ?? ''}</S.ResultCell>
                </S.ResultRow>
              ))}
            </S.ResultTable>
          </>
        )}
      </S.StyledCardWrapper>
    </S.StyledContainer>
  );
};

export default PeopleImport;
