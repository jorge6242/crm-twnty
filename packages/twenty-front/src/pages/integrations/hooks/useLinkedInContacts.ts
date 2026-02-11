import { useEffect, useMemo, useState } from 'react';
import { useSocialContactService } from '~/hooks/services/use-social-contact.service';

export interface SocialContactList {
  id: string;
  firstName: string;
  lastName: string;
  profilePictureUrl?: string;
  publicProfileUrl?: string;
  headline?: string;
  isAlreadyInCrm?: boolean;
  personId?: string | null;
}

interface LoadingStates {
  merge: boolean;
  disconnect: boolean;
  verify: boolean;
  loadMore: boolean;
  details: boolean;
  connect: boolean;
}

export const useLinkedInContacts = () => {
  const {
    getLinkedinAccountDetails: getLinkedinAccountDetailsApi,
    getLeadUserAccounts: getLeadUserAccountsApi,
    loginSocialAccount,
    validateSocialAccount,
    disconnectSocialAccount,
    storeContactsToPeople,
    getContactDetail,
  } = useSocialContactService();

  // State
  const [contacts, setContacts] = useState<SocialContactList[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [leadUserSocialAccounts, setLeadUserSocialAccounts] = useState<any[]>([]);
  const [businessMap, setBusinessMap] = useState<Record<string, boolean>>({});
  const [showSyncButton, setShowSyncButton] = useState(false);
  const [approveCode, setApproveCode] = useState<string>('');
  const [selectedAccountDetail, setSelectedAccountDetail] = useState<string | null>(null);
  const [accountDetailList, setAccountDetailList] = useState<any[]>([]);

  // Loading states
  const [loadingStates, setLoadingStates] = useState<LoadingStates>({
    merge: false,
    disconnect: false,
    verify: false,
    loadMore: false,
    details: false,
    connect: false,
  });

  // Computed values
  const selectedCount = useMemo(
    () => Object.values(businessMap).filter(Boolean).length,
    [businessMap]
  );

  const leadAccount = useMemo(
    () => leadUserSocialAccounts.find((e) => e.source === 'linkedin'),
    [leadUserSocialAccounts]
  );

  // Operations
  const fetchLeadUserAccounts = async () => {
    try {
      const data = await getLeadUserAccountsApi();
      setLeadUserSocialAccounts(data);
      return data;
    } catch (error) {
      return [];
    }
  };

  const fetchContacts = async (cursor?: string) => {
    try {
      if (cursor) {
        setLoadingStates((prev) => ({ ...prev, loadMore: true }));
      } else {
        setLoadingStates((prev) => ({ ...prev, verify: true }));
      }

      const response = await getLinkedinAccountDetailsApi('linkedin', cursor);
      const accountsData = response?.contacts ?? [];
      const newCursor = response?.nextCursor ?? null;

      if (accountsData.length) {
        setContacts((prev) => (cursor ? [...prev, ...accountsData] : accountsData));
        setNextCursor(newCursor);
        setBusinessMap((prev) => {
          const next = { ...prev };
          accountsData.forEach((acc: any) => {
            if (!acc?.id) return;
            if (typeof next[acc.id] === 'undefined') next[acc.id] = false;
          });
          return next;
        });
        setShowSyncButton(true);
      } else if (!cursor) {
        setShowSyncButton(false);
      }

      setLoadingStates((prev) => ({ ...prev, verify: false, loadMore: false }));
      return accountsData ?? null;
    } catch (error) {
      if (!cursor) {
        setShowSyncButton(false);
      }
      setLoadingStates((prev) => ({ ...prev, verify: false, loadMore: false }));
      return null;
    }
  };

  const loadMoreContacts = async () => {
    if (nextCursor) {
      await fetchContacts(nextCursor);
    }
  };

  const mergeSelectedContacts = async () => {
    const selectedContacts = contacts.filter(
      (acc) => acc?.id && !!businessMap[acc.id]
    );

    if (selectedContacts.length === 0) {
      return null;
    }

    try {
      setLoadingStates((prev) => ({ ...prev, merge: true }));
      const res = await storeContactsToPeople({ selectedContacts });

      if (res) {
        // Update local state: mark synchronized contacts as already in CRM
        const selectedIds = new Set(selectedContacts.map((c) => c.id));
        setContacts((prevAccounts) =>
          prevAccounts.map((acc) =>
            selectedIds.has(acc.id) ? { ...acc, isAlreadyInCrm: true } : acc
          )
        );

        // Clear businessMap for synchronized contacts
        setBusinessMap((prevMap) => {
          const newMap = { ...prevMap };
          selectedIds.forEach((id) => delete newMap[id]);
          return newMap;
        });
      }

      setLoadingStates((prev) => ({ ...prev, merge: false }));
      return res ?? null;
    } catch (error) {
      setLoadingStates((prev) => ({ ...prev, merge: false }));
      return null;
    }
  };

  const disconnectAccount = async (provider: string) => {
    try {
      setLoadingStates((prev) => ({ ...prev, disconnect: true }));
      const res = await disconnectSocialAccount({ provider });
      if (res) {
        setLoadingStates((prev) => ({ ...prev, disconnect: false }));
        setContacts([]);
        setNextCursor(null);
        setShowSyncButton(false);
      }
    } catch (error) {
      setLoadingStates((prev) => ({ ...prev, disconnect: false }));
    }
  };

  const verifyAccount = async (provider: string) => {
    setLoadingStates((prev) => ({ ...prev, verify: true }));
    try {
      await validateSocialAccount({ provider, code: approveCode });
      const account = await fetchContacts();
      if (account && account.status === 'linked') {
        setLoadingStates((prev) => ({ ...prev, verify: false }));
        setShowSyncButton(true);
      } else {
        setShowSyncButton(false);
      }
    } catch (error) {
      setShowSyncButton(false);
    } finally {
      setLoadingStates((prev) => ({ ...prev, verify: false }));
    }
  };

  const connectAccount = async ({
    username,
    password,
  }: {
    username: string;
    password: string;
  }) => {
    setLoadingStates((prev) => ({ ...prev, connect: true }));
    const result = await loginSocialAccount({ username, password });
    if (result) {
      setShowSyncButton(true);
      setLoadingStates((prev) => ({ ...prev, connect: false }));
    } else {
      setLoadingStates((prev) => ({ ...prev, connect: false }));
    }
  };

  const toggleContactSelection = (contactId: string) => {
    setBusinessMap((prev) => ({ ...prev, [contactId]: !prev[contactId] }));
  };

  const fetchContactDetails = async (contactId: string, accountId: string) => {
    setSelectedAccountDetail(contactId);
    setLoadingStates((prev) => ({ ...prev, details: true }));
    const currentSocialAccountId = leadAccount ? leadAccount.id : '';

    const contact = await getContactDetail({
      contactId,
      accountId: currentSocialAccountId,
    });
    setLoadingStates((prev) => ({ ...prev, details: false }));
    setAccountDetailList((prev) => [...prev, contact]);
    return contact;
  };

  // Initialize on mount
  useEffect(() => {
    fetchContacts();
    fetchLeadUserAccounts();
  }, []);

  return {
    // State
    contacts,
    nextCursor,
    leadAccount,
    selectedCount,
    showSyncButton,
    approveCode,
    setApproveCode,
    businessMap,
    accountDetailList,
    selectedAccountDetail,

    // Loading states
    isLoading: loadingStates,

    // Operations
    fetchContacts,
    loadMoreContacts,
    mergeSelectedContacts,
    disconnectAccount,
    verifyAccount,
    connectAccount,
    toggleContactSelection,
    fetchContactDetails,
  };
};
