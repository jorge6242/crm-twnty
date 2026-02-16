import { useTheme } from '@emotion/react';
import styled from '@emotion/styled';
import { IconUser } from 'twenty-ui/display';
import { Button } from 'twenty-ui/input';
import { SocialContactList } from '~/pages/integrations/hooks/useLinkedInContacts';
import * as S from '../SocialContacts.styles';

const AvatarContainer = styled.div`
  width: 56px;
  height: 56px;
  border-radius: 8px;
  flex-shrink: 0;
  background: linear-gradient(135deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01));
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
`;

const AvatarIcon = styled(IconUser)`
  color: ${({ theme }) => theme.font.color.tertiary};
`;

export interface SocialContactDetail {
  id?: string;
  email?: string;
  lastCompany?: {
    name?: string;
    position?: string;
    location?: string;
    description?: string;
    startDate?: string;
    endDate?: string;
  };
}

interface SocialContactListItemProps {
  contact: SocialContactList;
  contactDetail: SocialContactDetail | null | undefined;
  isSelected: boolean;
  isAlreadyInCrm: boolean;
  isDetailsLoading: boolean;
  onToggleSelection: () => void;
  onShowDetails?: (() => void) | null;
  contactLabel?: string;
}

export const SocialContactListItem = ({
  contact,
  contactDetail,
  isSelected,
  isAlreadyInCrm,
  isDetailsLoading,
  onToggleSelection,
  onShowDetails = null,
  contactLabel = 'LinkedIn contact',
}: SocialContactListItemProps) => {
  const theme = useTheme();
  const displayName = `${contact.firstName ?? ''} ${contact.lastName ?? ''}`.trim() || 'Unknown';
  const hasProfilePicture = !!contact.profilePictureUrl;

  return (
    <S.ContactItem
      role="listitem"
      aria-label={`${contactLabel} ${displayName}`}
    >
      <AvatarContainer>
        {hasProfilePicture ? (
          <S.Avatar
            src={contact.profilePictureUrl}
            alt={displayName}
          />
        ) : (
          <AvatarIcon size={theme.icon.size.lg} />
        )}
      </AvatarContainer>
      <S.ContactInfo>
        <S.Name>{displayName}</S.Name>
        <S.Headline>{contact.headline}</S.Headline>
        {
          contact.email && (
            <S.Headline>{contact.email}</S.Headline>
          )
        }
        {contact?.publicProfileUrl && (
          <S.ProfileLink
            href={contact.publicProfileUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            {contact.publicProfileUrl}
          </S.ProfileLink>
        )}
        {contactDetail && (
          <S.LastJob>
            <p>Company: {contactDetail?.lastCompany?.name}</p>
            <p>Position: {contactDetail?.lastCompany?.position}</p>
            <p>Email: {contactDetail?.email}</p>
          </S.LastJob>
        )}
        { onShowDetails && (
          <Button
            isLoading={isDetailsLoading}
            title="Show Details"
            onClick={() => onShowDetails()}
          />
        )}
      </S.ContactInfo>
      <S.SwitchContainer>
        <S.SwitchButton
          $active={isSelected || isAlreadyInCrm}
          aria-pressed={isSelected || isAlreadyInCrm}
          onClick={() => !isAlreadyInCrm && onToggleSelection()}
          style={{
            cursor: isAlreadyInCrm ? 'default' : 'pointer',
            opacity: isAlreadyInCrm ? 0.7 : 1,
          }}
        >
          {isAlreadyInCrm
            ? 'Synchronized'
            : isSelected
              ? 'Business account selected'
              : 'Not Selected'}
        </S.SwitchButton>
      </S.SwitchContainer>
    </S.ContactItem>
  );
};
