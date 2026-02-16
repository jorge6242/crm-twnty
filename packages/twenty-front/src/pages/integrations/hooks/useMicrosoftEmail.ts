import { useApolloClient } from '@apollo/client';
import { useEffect, useState } from 'react';
import * as svc from '~/services/social-contacts.service';

export const useMicrosoftEmail = () => {
  const client = useApolloClient();

  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Verificar si ya hay cuenta conectada
  const checkMicrosoftConnection = async () => {
    try {
      const accounts = await svc.getLeadUserAccounts(client);
      const msAccount = accounts.find((acc: any) => acc.source === 'MICROSOFT');
      setIsConnected(!!msAccount);
    } catch (error) {
      console.error('Error checking Microsoft connection:', error);
    }
  };

  // Iniciar OAuth con Microsoft
  const connectMicrosoft = async (redirectUrl: string) => {
    setIsLoading(true);
    await svc.initiateMicrosoftAuth(client, redirectUrl);
    // El redirect ocurre automáticamente
  };

  useEffect(() => {
    checkMicrosoftConnection();
  }, []);

  return {
    isConnected,
    isLoading,
    connectMicrosoft,
    checkMicrosoftConnection,
  };
};
