import styled from '@emotion/styled';
import { Button } from 'twenty-ui/input';
import { useWhatsAppAuth } from '~/pages/integrations/hooks/useWhatsappAuth';


const StyledContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  align-items: center;
  padding: 16px;
`;

const StyledQrCode = styled.img`
  max-width: 300px;
  height: auto;
  margin: 16px 0;
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  border-radius: 8px;
  padding: 8px;
  background: white;
`;

const StyledMessage = styled.p`
  margin: 0;
  font-size: 14px;
  color: white;
`;

export const WhatsAppConnectButton = ({ fetchContacts, fetchLeadUserAccounts }: { fetchContacts: () => void, fetchLeadUserAccounts: () => void }) => {
  const { connectWhatsApp, qrCodeUrl, isLoading, isConnected, isWaitingForAuth } = useWhatsAppAuth({ fetchLeadUserAccounts });
  if (isConnected) {
    return (
      <StyledContainer>
        <StyledMessage>WhatsApp is connected, syncing contacts...</StyledMessage>
        <Button
          variant="secondary"
          title="Refresh to get Contacts"
          onClick={() => fetchContacts()}
          isLoading={isLoading}
          disabled={isLoading}
        />
      </StyledContainer>
    );
  }

  return (
    <StyledContainer>
      <Button
        onClick={connectWhatsApp}
        disabled={isLoading}
        variant="secondary"
        title={isLoading || isWaitingForAuth ? 'Connecting...' : 'Connect WhatsApp'}
        isLoading={isLoading}
      />

      {isWaitingForAuth && (
        <StyledMessage>Waiting for authentication...</StyledMessage>
      )}

      {!isWaitingForAuth && qrCodeUrl && (
        <>
          <p>Scan the QR code with WhatsApp on your phone</p>
          <StyledQrCode src={qrCodeUrl} alt="WhatsApp QR Code" />
          <p>Or open WhatsApp &​gt; Menu &​gt; Linked Devices</p>
        </>
      )}
    </StyledContainer>
  );
};
