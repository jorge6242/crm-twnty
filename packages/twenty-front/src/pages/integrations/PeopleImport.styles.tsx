import styled from '@emotion/styled';

// ── Layout ───────────────────────────────────────────────────────────────────

export const StyledContainer = styled.div`
  display: flex;
  flex-direction: column;
  min-height: 100dvh;
  width: 100%;
  padding: ${({ theme }) => theme.spacing(6)};
`;

export const StyledCardWrapper = styled.div`
  display: flex;
  background-color: ${({ theme }) => theme.background.primary};
  flex-direction: column;
  align-items: stretch;
  width: 100%;
  padding: ${({ theme }) => theme.spacing(6)};
  box-shadow: ${({ theme }) => theme.boxShadow.strong};
  border-radius: ${({ theme }) => theme.border.radius.md};
  gap: ${({ theme }) => theme.spacing(4)};
`;

export const Description = styled.p`
  color: ${({ theme }) => theme.font.color.secondary};
  font-size: ${({ theme }) => theme.font.size.md};
  margin: 0;
`;

// ── Drop Zone ────────────────────────────────────────────────────────────────

export const DropZone = styled.label<{ $isDragging?: boolean; $hasFile?: boolean }>`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: ${({ theme }) => theme.spacing(3)};
  padding: ${({ theme }) => theme.spacing(8)};
  border: 2px dashed
    ${({ $isDragging, $hasFile, theme }) =>
      $isDragging
        ? theme.color.blue
        : $hasFile
          ? theme.font.color.primary
          : theme.font.color.tertiary};
  border-radius: ${({ theme }) => theme.border.radius.md};
  cursor: pointer;
  transition: border-color 150ms ease, background 150ms ease;
  background: ${({ $isDragging }) =>
    $isDragging ? 'rgba(59, 130, 246, 0.05)' : 'transparent'};

  &:hover {
    border-color: ${({ theme }) => theme.font.color.primary};
  }
`;

export const DropZoneText = styled.span`
  color: ${({ theme }) => theme.font.color.secondary};
  font-size: ${({ theme }) => theme.font.size.md};
`;

export const FileName = styled.span`
  color: ${({ theme }) => theme.font.color.primary};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  font-size: ${({ theme }) => theme.font.size.md};
`;

export const HiddenInput = styled.input`
  display: none;
`;

// ── Strategy Selector ────────────────────────────────────────────────────────

export const StrategyBar = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(2)};
`;

export const StrategyLabel = styled.span`
  color: ${({ theme }) => theme.font.color.secondary};
  font-size: ${({ theme }) => theme.font.size.sm};
  font-weight: ${({ theme }) => theme.font.weight.medium};
`;

export const StrategyButton = styled.button<{ $active?: boolean }>`
  appearance: none;
  border: 1px solid
    ${({ $active, theme }) =>
      $active ? theme.font.color.primary : theme.font.color.tertiary};
  background: ${({ $active }) =>
    $active ? 'rgba(255, 255, 255, 0.08)' : 'transparent'};
  color: ${({ theme }) => theme.font.color.primary};
  padding: ${({ theme }) => theme.spacing(1)} ${({ theme }) => theme.spacing(3)};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  cursor: pointer;
  font-size: ${({ theme }) => theme.font.size.sm};
  font-weight: ${({ $active, theme }) =>
    $active ? theme.font.weight.semiBold : theme.font.weight.regular};
  transition: all 120ms ease;

  &:hover {
    border-color: ${({ theme }) => theme.font.color.primary};
  }
`;

// ── Actions ──────────────────────────────────────────────────────────────────

export const ActionBar = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: ${({ theme }) => theme.spacing(3)};
`;

// ── Summary Counters ─────────────────────────────────────────────────────────

export const SummaryBar = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing(4)};
  padding: ${({ theme }) => theme.spacing(3)} 0;
  flex-wrap: wrap;
`;

export const Counter = styled.div<{ $color?: string }>`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(0.5)};
`;

export const CounterValue = styled.span<{ $color?: string }>`
  font-size: ${({ theme }) => theme.font.size.xl};
  font-weight: ${({ theme }) => theme.font.weight.semiBold};
  color: ${({ $color, theme }) => $color ?? theme.font.color.primary};
`;

export const CounterLabel = styled.span`
  font-size: ${({ theme }) => theme.font.size.xs};
  color: ${({ theme }) => theme.font.color.tertiary};
  text-transform: uppercase;
  letter-spacing: 0.04em;
`;

// ── Result Table ─────────────────────────────────────────────────────────────

export const ResultTable = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(1)};
  max-height: calc(100vh - 450px);
  overflow-y: auto;
  padding-right: ${({ theme }) => theme.spacing(2)};

  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.02);
    border-radius: 10px;
  }

  &::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 10px;
  }

  &::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.2);
  }
`;

export const ResultRow = styled.div`
  display: grid;
  grid-template-columns: 50px 1fr 1fr 100px 1fr;
  gap: ${({ theme }) => theme.spacing(3)};
  align-items: center;
  padding: ${({ theme }) => theme.spacing(2)} ${({ theme }) => theme.spacing(3)};
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  font-size: ${({ theme }) => theme.font.size.sm};
`;

export const ResultRowHeader = styled(ResultRow)`
  background: rgba(255, 255, 255, 0.04);
  font-weight: ${({ theme }) => theme.font.weight.semiBold};
  color: ${({ theme }) => theme.font.color.secondary};
  position: sticky;
  top: 0;
  z-index: 1;
`;

const STATUS_COLORS: Record<string, string> = {
  created: '#4ade80',
  updated: '#60a5fa',
  skipped: '#fbbf24',
  error: '#f87171',
};

export const StatusBadge = styled.span<{ $status: string }>`
  display: inline-block;
  padding: ${({ theme }) => theme.spacing(0.5)} ${({ theme }) => theme.spacing(2)};
  border-radius: 999px;
  font-size: ${({ theme }) => theme.font.size.xs};
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  background: ${({ $status }) =>
    `${STATUS_COLORS[$status] ?? '#94a3b8'}15`};
  color: ${({ $status }) =>
    STATUS_COLORS[$status] ?? '#94a3b8'};
  border: 1px solid
    ${({ $status }) =>
      `${STATUS_COLORS[$status] ?? '#94a3b8'}33`};
`;

export const ResultCell = styled.span`
  color: ${({ theme }) => theme.font.color.primary};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

export const ErrorMessage = styled.div`
  color: #f87171;
  font-size: ${({ theme }) => theme.font.size.sm};
  padding: ${({ theme }) => theme.spacing(2)};
  border: 1px solid rgba(248, 113, 113, 0.2);
  border-radius: ${({ theme }) => theme.border.radius.sm};
  background: rgba(248, 113, 113, 0.05);
`;

// ── Filter bar ───────────────────────────────────────────────────────────────

export const FilterBar = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(2)};
  padding: ${({ theme }) => theme.spacing(1)} 0;
`;
