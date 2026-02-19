// src/pages/integrations/hooks/useWhatsAppAuth.ts
import { useApolloClient } from '@apollo/client';
import { useCallback, useState } from 'react';
import { checkWhatsAppAuthStatus, initiateWhatsAppAuth } from '~/services/social-contacts.service';

export const useWhatsAppAuth = ({ fetchLeadUserAccounts }: { fetchLeadUserAccounts: () => void }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isWaitingForAuth, setIsWaitingForAuth] = useState(false);
  const apolloClient = useApolloClient();

  const connectWhatsApp = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await initiateWhatsAppAuth(apolloClient);

      if (data?.success) {
        setQrCodeUrl(data.qrCodeUrl);
        pollAuthStatus(data.verificationCode);
      } else {
        throw new Error(data?.message || 'Failed to connect to WhatsApp');
      }
    } catch (error) {
    //   enqueueSnackBar('Error connecting to WhatsApp', { variant: 'error' });
      console.error('WhatsApp connection error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [apolloClient]);

  const pollAuthStatus = async (verificationCode: string) => {
    const checkStatus = async () => {
      try {
        console.log('Checking WhatsApp status for code:', verificationCode);
        const data = await checkWhatsAppAuthStatus(apolloClient, verificationCode);

        console.log('WhatsApp status response:', data);

        if (data?.status === 'OK' || data?.status === 'authenticated') {
          setIsConnected(true);
          setQrCodeUrl(null);
          setIsWaitingForAuth(false);
          fetchLeadUserAccounts();
          console.log('WhatsApp connected successfully!');
        // enqueueSnackBar('WhatsApp connected successfully!', { variant: 'success' });
        } else if (data?.status === 'failed' || data?.status === 'expired') {
          throw new Error(data?.message || 'Authentication failed or QR code expired');
        } else if (data?.status === 'CONNECTING' || data?.status === 'waiting') {
          // Sigue verificando cada 3 segundos
          console.log('WhatsApp authentication pending, checking again in 3 seconds...');
          setIsWaitingForAuth(true);
          setTimeout(checkStatus, 3000);
        } else {
          // Estado desconocido, sigue verificando
          console.log('Unknown WhatsApp status:', data?.status, 'checking again in 3 seconds...');
          setTimeout(checkStatus, 3000);
        }
      } catch (error) {
        console.error('Error checking WhatsApp status:', error);
        // enqueueSnackBar('Error verifying WhatsApp status', { variant: 'error' });
        // Para errores de red, podemos reintentar unas cuantas veces más
        setTimeout(checkStatus, 5000);
      }
    };

    checkStatus();
  };

  return {
    connectWhatsApp,
    qrCodeUrl,
    isLoading,
    isConnected,
    isWaitingForAuth
  };
};
