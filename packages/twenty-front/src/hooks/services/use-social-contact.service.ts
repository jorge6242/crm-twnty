import { useApolloClient } from '@apollo/client';
import { useCallback, useMemo } from 'react';
import { SocialContactList } from '~/pages/integrations/SocialContacts';
import * as svc from '../../services/social-contacts.service';

export function useSocialContactService() {
  const client = useApolloClient();

  const getLeadUserAccounts = useCallback(async () => svc.getLeadUserAccounts(client), [client]);
  const getLinkedinAccountDetails = useCallback(async (provider = 'linkedin', cursor?: string) => svc.getLinkedinAccountDetails(client, provider, cursor), [client]);
  const loginSocialAccount = useCallback(async (payload: { username: string; password: string; }) => svc.loginSocialAccount(client, payload), [client]);
  const validateSocialAccount = useCallback(async (payload: { provider: string; code: string; }) => svc.validateSocialAccount(client, payload), [client]);
  const disconnectSocialAccount = useCallback(async (payload: { provider: string }) => svc.disconnectSocialAccount(client, payload), [client]);
  const storeContactsToPeople = useCallback(async (payload: { selectedContacts: SocialContactList[] }) => svc.storeContactsToPeople(client, payload), [client]);
  const getContactDetail = useCallback(async (payload: { contactId: string, accountId: string }) => svc.getContactDetail(client, payload), [client]);

  return useMemo(() => ({
    getLeadUserAccounts,
    getLinkedinAccountDetails,
    loginSocialAccount,
    validateSocialAccount,
    disconnectSocialAccount,
    storeContactsToPeople,
    getContactDetail,
  }), [getLeadUserAccounts,
    getLinkedinAccountDetails,
    loginSocialAccount,
    validateSocialAccount,
    disconnectSocialAccount,
    storeContactsToPeople,
    getContactDetail
  ]);
}
