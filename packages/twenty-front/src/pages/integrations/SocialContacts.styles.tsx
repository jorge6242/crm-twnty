import styled from '@emotion/styled';

export const SectionTitle = styled.h3`
  color: #fff;
  margin: 0 0 ${({ theme }) => theme.spacing(2)} 0;
  font-size: ${({ theme }) => theme.font.size.md};
`;

export const SectionSubtitle = styled.div`
  color: #fff;
  font-size: ${({ theme }) => theme.font.size.md};
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 500;
  justify-content: start;
`;

export const ContactList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(3)};
  margin-top: ${({ theme }) => theme.spacing(3)};
  max-height: calc(100vh - 350px);
  overflow-y: auto;
  padding-right: ${({ theme }) => theme.spacing(2)};

  /* Custom Scrollbar - Premium Aesthetics */
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
    transition: background 0.2s ease;
  }

  &::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.2);
  }
`;

export const ContactItem = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(3)};
  padding: ${({ theme }) => theme.spacing(3)};
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: ${({ theme }) => theme.border.radius.sm};
  transition: background 120ms ease, transform 120ms ease;
  &:hover {
    background: rgba(255, 255, 255, 0.05);
    transform: translateY(-2px);
  }
`;

export const Avatar = styled.img`
  width: 56px;
  height: 56px;
  border-radius: 8px;
  object-fit: cover;
  flex-shrink: 0;
  background: linear-gradient(135deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01));
`;

export const ContactInfo = styled.div`
  display: flex;
  flex-direction: column;
  min-width: 0;
  gap: ${({ theme }) => theme.spacing(1)};
`;

export const Name = styled.div`
  color: #fff;
  font-weight: 600;
  font-size: ${({ theme }) => theme.font.size.xl};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

export const Headline = styled.div`
  color: #fff;
  font-weight: 600;
  font-size: ${({ theme }) => theme.font.size.md};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-style: italic;
`;

export const LastJob = styled.div`
  color: #fff;
  font-weight: 600;
  font-size: ${({ theme }) => theme.font.size.sm};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

export const ShowDetailsButton = styled.button<{ $active?: boolean }>`
  color: #fff;
  font-weight: 600;
  font-size: ${({ theme }) => theme.font.size.md};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  cursor: pointer;
  background: transparent;
  border: none;
  padding: 0;
  margin: 0;
  &:hover {
    text-decoration: underline;
  }
`;

export const ProfileLink = styled.a`
  color: rgba(255,255,255,0.75);
  font-size: ${({ theme }) => theme.font.size.sm};
  text-decoration: none;
  margin-top: ${({ theme }) => theme.spacing(0.5)};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  &:hover {
    text-decoration: underline;
  }
`;

/* Mantengo los estilos ya existentes exportados con los mismos nombres */
export const StyledContainer = styled.div`
  display: flex;
  flex-direction: column;
  min-height: 100dvh;
  width: 100%;
  padding: ${({ theme }) => theme.spacing(6)};
`;

export const StyledTabBar = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing(2)};
  margin-bottom: ${({ theme }) => theme.spacing(4)};
`;

export const StyledTabButton = styled.button<{ $active?: boolean }>`
  background: ${({ $active, theme }) => $active ? theme.background.secondary : 'transparent'};
  color: ${({ theme }) => theme.font.color.primary};
  border: ${({ $active }) => ($active ? '2px solid #ffffffff' : '1px solid #b2b1b1ff')} ;
  padding: ${({ theme }) => theme.spacing(2)} ${({ theme }) => theme.spacing(3)};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  cursor: pointer;
  font-size: ${({ theme }) => theme.font.size.lg};
`;

export const TabContent = styled.div`
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: stretch;
`;

export const StyledCardWrapper = styled.div`
  display: flex;
  background-color: ${({ theme }) => theme.background.primary};
  flex-direction: column;
  align-items: stretch;
  justify-content: flex-start;
  width: 100%;
  padding: ${({ theme }) => theme.spacing(6)};
  box-shadow: ${({ theme }) => theme.boxShadow.strong};
  border-radius: ${({ theme }) => theme.border.radius.md};
  gap: ${({ theme }) => theme.spacing(4)};
`;

export const StyledTitle = styled.h2`
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.xl};
  margin: 0 0 ${({ theme }) => theme.spacing(4)} 0;
  font-weight: ${({ theme }) => theme.font.weight.semiBold};
`;

export const StyledMessage = styled.div`
  color: white;
  font-size: ${({ theme }) => theme.font.size.md};
  margin-top: ${({ theme }) => theme.spacing(2)};
`;


export const SwitchContainer = styled.div`
  margin-left: auto;
  display: flex;
  align-items: center;
`;

export const SwitchButton = styled.button<{ $active?: boolean }>`
  appearance: none;
  border: none;
  cursor: pointer;
  padding: ${({ theme }) => theme.spacing(1)} ${({ theme }) => theme.spacing(2)};
  border-radius: 999px;
  background: ${({ $active }) =>
    $active ? 'linear-gradient(90deg,#06b6d4,#3b82f6)' : 'rgba(255,255,255,0.06)'};
  color: ${({ $active }) => ($active ? '#061826' : 'rgba(255,255,255,0.9)')};
  font-weight: 600;
  font-size: ${({ theme }) => theme.font.size.sm};
  transition: background .12s ease, transform .08s ease;
  &:active { transform: scale(0.98); }
`;

export const HeaderContactContainer = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(3)};
`;

export const BodyContactContainer = styled.div`
  align-items: center;
  display: flex;
  flex-direction: column;
  padding-left: ${({ theme }) => theme.spacing(9)};
  padding-right: ${({ theme }) => theme.spacing(9)};
  gap: ${({ theme }) => theme.spacing(7)};
`;

export const BodyContactDetails = styled.div`
  display: flex;
  justify-content: space-between;
  min-width: 0;
  width: 100%;
  border: 2px solid white;
  padding: 10px;
  border-radius: ${({ theme }) => theme.border.radius.md};
`;

export const BodyContactDetails2 = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: start;
`;


export const SocialVerifyContainer = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-direction: column;
  min-width: 0;
  gap: ${({ theme }) => theme.spacing(4)};
  border: 2px solid grey;
  padding: ${({ theme }) => theme.spacing(4)};
  border-radius: ${({ theme }) => theme.border.radius.md};
`;

export const SocialVerifyInputsContainer = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  min-width: 0;
  gap: ${({ theme }) => theme.spacing(4)};
`;

export const SocialValidationContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: ${({ theme }) => theme.spacing(4)};
`;

export const SocialButton = styled.button`
  background: linear-gradient(90deg, #06b6d4, #3b82f6);
  color: #061826;
  border: none;
  padding: ${({ theme }) => theme.spacing(2)} ${({ theme }) => theme.spacing(4)};
  border-radius: ${({ theme }) => theme.border.radius.md};
  cursor: pointer;
  font-weight: 600;
  font-size: ${({ theme }) => theme.font.size.md};
  transition: background 0.12s ease, transform 0.08s ease;
  &:hover {
    background: linear-gradient(90deg, #0e7490, #2563eb);
  }
  &:active {
    transform: scale(0.98);
  }
`;

export const InputApproveCodeContainer = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing(2)};
  align-items: center;
`;


export const PresenceBadge = styled.div<{ $present?: boolean }>`
  background: ${({ $present }) => ($present ? 'rgba(34, 197, 94, 0.1)' : 'rgba(255, 255, 255, 0.04)')};
  color: ${({ $present }) => ($present ? '#4ade80' : 'rgba(255, 255, 255, 0.5)')};
  border: 1px solid ${({ $present }) => ($present ? 'rgba(74, 222, 128, 0.2)' : 'rgba(255, 255, 255, 0.1)')};
  padding: ${({ theme }) => theme.spacing(0.5)} ${({ theme }) => theme.spacing(2)};
  border-radius: 4px;
  font-size: 10px;
  text-transform: uppercase;
  font-weight: 700;
  letter-spacing: 0.05em;
`;

export const StyledActionButtons = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing(2)};
  align-items: center;
`;

export const BodyContactDetailsContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(2)};
  width: 100%;
`;
