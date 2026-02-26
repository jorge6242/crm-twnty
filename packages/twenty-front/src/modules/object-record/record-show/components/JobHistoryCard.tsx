import { useFindManyRecords } from '@/object-record/hooks/useFindManyRecords';
import { formatDate, getSourceLabel } from '@/object-record/utils/date';
import { useLayoutRenderingContext } from '@/ui/layout/contexts/LayoutRenderingContext';
import styled from '@emotion/styled';
import { formatDistanceToNow } from 'date-fns';
import { IconBriefcase, IconBuildingSkyscraper, IconCalendar } from 'twenty-ui/display';

const StyledContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(4)};
  padding: ${({ theme }) => theme.spacing(4)};
`;

const StyledEmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: ${({ theme }) => theme.spacing(8)};
  color: ${({ theme }) => theme.font.color.tertiary};
  gap: ${({ theme }) => theme.spacing(2)};
`;

const StyledJobHistoryItem = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing(3)};
  position: relative;
  padding-bottom: ${({ theme }) => theme.spacing(4)};

  &:not(:last-child)::after {
    content: '';
    position: absolute;
    left: 11px;
    top: 32px;
    bottom: -${({ theme }) => theme.spacing(2)};
    width: 2px;
    background: ${({ theme }) => theme.border.color.medium};
  }
`;

const StyledIconContainer = styled.div<{ isCurrent: boolean }>`
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: ${({ theme, isCurrent }) =>
    isCurrent ? theme.color.blue : theme.background.tertiary};
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${({ theme, isCurrent }) =>
    isCurrent ? 'white' : theme.font.color.tertiary};
  z-index: 1;
`;

const StyledContent = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(1)};
`;

const StyledHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: ${({ theme }) => theme.spacing(2)};
`;

const StyledJobTitle = styled.div`
  font-weight: ${({ theme }) => theme.font.weight.medium};
  font-size: ${({ theme }) => theme.font.size.md};
  color: ${({ theme }) => theme.font.color.primary};
`;

const StyledCurrentBadge = styled.span`
  background: ${({ theme }) => theme.color.blue};
  color: white;
  padding: ${({ theme }) => theme.spacing(1)} ${({ theme }) => theme.spacing(2)};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  font-size: ${({ theme }) => theme.font.size.xs};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  flex-shrink: 0;
`;

const StyledCompanyRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(1)};
  color: ${({ theme }) => theme.font.color.secondary};
  font-size: ${({ theme }) => theme.font.size.sm};
`;

const StyledDatesRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(1)};
  color: ${({ theme }) => theme.font.color.tertiary};
  font-size: ${({ theme }) => theme.font.size.sm};
`;

const StyledSourceBadge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(1)};
  background: ${({ theme }) => theme.background.transparent.light};
  padding: ${({ theme }) => theme.spacing(0.5)} ${({ theme }) => theme.spacing(1.5)};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  font-size: ${({ theme }) => theme.font.size.xs};
  color: ${({ theme }) => theme.font.color.tertiary};
  margin-top: ${({ theme }) => theme.spacing(1)};
`;

const StyledJobStartDate = styled.span`
    color: ${({ theme }) => theme.font.color.tertiary};
    margin-left: ${({ theme }) => theme.spacing(1)};
    font-size: ${({ theme }) => theme.font.size.xs};
`;

const StyledNotDataMessage = styled.div`
  font-size: ${({ theme }) => theme.font.size.sm};
  color: ${({ theme }) => theme.font.color.tertiary};
`;

export const JobHistoryCard = () => {
  const { targetRecordIdentifier } = useLayoutRenderingContext();

  const { records: jobHistories, loading } = useFindManyRecords({
    objectNameSingular: 'personJobHistory',
    filter: {
      personId: { eq: targetRecordIdentifier?.id },
    },
    orderBy: [
      { isCurrent: 'DescNullsLast' },
      { startDate: 'DescNullsLast' },
    ],
  });

  if (loading) {
    return (
      <StyledEmptyState>
        <IconBriefcase size={40} />
        <div>Loading job history...</div>
      </StyledEmptyState>
    );
  }

  if (!jobHistories || jobHistories.length === 0) {
    return (
      <StyledEmptyState>
        <IconBriefcase size={40} />
        <div>No job history available</div>
        <StyledNotDataMessage>
          Job history will appear here when contacts are imported from LinkedIn or other sources
        </StyledNotDataMessage>
      </StyledEmptyState>
    );
  }

  return (
    <StyledContainer>
      {jobHistories.map((job: any) => (
        <StyledJobHistoryItem key={job.id}>
          <StyledIconContainer isCurrent={job.isCurrent}>
            <IconBriefcase size={14} />
          </StyledIconContainer>

          <StyledContent>
            <StyledHeader>
              <StyledJobTitle>
                {job.jobTitle || 'Position not specified'}
              </StyledJobTitle>
              {job.isCurrent && <StyledCurrentBadge>Current</StyledCurrentBadge>}
            </StyledHeader>

            {job.company && (
              <StyledCompanyRow>
                <IconBuildingSkyscraper size={14} />
                <span>{job.company.name}</span>
              </StyledCompanyRow>
            )}

            <StyledDatesRow>
              <IconCalendar size={14} />
              <span>
                {formatDate(job.startDate)} — {job.endDate ? formatDate(job.endDate) : 'Present'}
              </span>
              {job.startDate && (
                <StyledJobStartDate>
                  ({formatDistanceToNow(new Date(job.startDate), { addSuffix: false })})
                </StyledJobStartDate>
              )}
            </StyledDatesRow>

            {job.source && (
              <StyledSourceBadge>
                Source: {getSourceLabel(job.source)}
              </StyledSourceBadge>
            )}
          </StyledContent>
        </StyledJobHistoryItem>
      ))}
    </StyledContainer>
  );
};
