import styled from '@emotion/styled';
import { useEffect, useState } from 'react';
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

const StyledQrCodeContainer = styled.div`
  margin-top: 30px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
`;

export const WhatsAppConnectButton = ({ fetchContacts, fetchLeadUserAccounts }: { fetchContacts: () => void, fetchLeadUserAccounts: () => void }) => {
  const [ isTemporalTimer, setIsTemporalTimer ] = useState(false);
  const [countdown, setCountdown] = useState(30);
  const { connectWhatsApp, qrCodeUrl, isLoading, isConnected, isWaitingForAuth } = useWhatsAppAuth({ fetchLeadUserAccounts });

  useEffect(() => {
    if (!isTemporalTimer) {
      setCountdown(30);
      return;
    }
    const intervalId = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          setIsTemporalTimer(false);
          return 30;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(intervalId);
  }, [isTemporalTimer]);

  useEffect(() => {
    if (isConnected) {
      setIsTemporalTimer(true);
      setCountdown(30);
    }
  }, [isConnected]);

  if (isConnected) {
    return (
      <StyledContainer>
        <StyledMessage>WhatsApp is connected, syncing contacts...</StyledMessage>
        <Button
          variant="secondary"
          title={isTemporalTimer ? `Syncing... ${countdown}s` : "Refresh to get Contacts"}
          onClick={() => fetchContacts()}
          isLoading={isLoading}
          disabled={isTemporalTimer ||isLoading}
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
        <StyledQrCodeContainer>
          <StyledMessage>Scan the QR code with WhatsApp on your phone</StyledMessage>
          <StyledQrCode src={qrCodeUrl} alt="WhatsApp QR Code" />
          <StyledMessage>Or open WhatsApp &gt; Menu &gt; Linked Devices</StyledMessage>
        </StyledQrCodeContainer>
      )}
    </StyledContainer>
  );
};
