import { useEffect, useMemo, useState } from 'react';
import { useSocialContactService } from '~/hooks/services/use-social-contact.service';

export interface SocialContactList {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  profilePictureUrl?: string;
  publicProfileUrl?: string;
  headline?: string;
  isAlreadyInCrm?: boolean;
  personId?: string | null;
  lastCompany?: {
    name: string;
    position: string;
    location: string;
    email?: string;
    updatedAt?: string;
  } | null;
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
    getEnrichmentEmail,
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
  const [activeTab, setActiveTab] = useState<string>("");

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

  const leadAccount = useMemo(() => leadUserSocialAccounts.find((e) => e.source === activeTab),[leadUserSocialAccounts, activeTab]);

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
    console.log('activeTab ', activeTab);
    console.log('cursor ', cursor);
    fetchLeadUserAccounts();
    try {
      if (cursor) {
        setLoadingStates((prev) => ({ ...prev, loadMore: true }));
      } else {
        setLoadingStates((prev) => ({ ...prev, verify: true }));
      }

      const response = await getLinkedinAccountDetailsApi(activeTab ?? 'linkedin', cursor);
      const accountsData = response?.contacts ?? [];
      const newCursor = response?.nextCursor ?? null;

      if (accountsData.length) {
        // Crear Set de emails existentes para búsqueda rápida
        const existingEmails = new Set(contacts.map(c => c.email).filter(Boolean));

        // Filtrar solo los contactos nuevos que no existen por email
        const newContactsOnly = accountsData.filter((contact: any) =>
          !contact.email || !existingEmails.has(contact.email)
        );

        setContacts((prev) => (cursor ? [...prev, ...newContactsOnly] : newContactsOnly));
        setNextCursor(newCursor);
        setBusinessMap((prev) => {
          const next = { ...prev };
          newContactsOnly.forEach((acc: any) => {
            if (!acc?.id) return;
            if (typeof next[acc.id] === 'undefined') next[acc.id] = false;
          });
          return next;
        });
        setShowSyncButton(true);
      } else if (!cursor) {
        setContacts([]);
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
      const res = await storeContactsToPeople({ selectedContacts, provider: activeTab });
      console.log('mergeSelectedContacts res ', res)
      if (res) {
        // Update local state: mark synchronized contacts as already in CRM
          const createdPeople: any[] = res.peopleCreadtedList || [];

          // Map por id para lookup eficiente
          const createdPeopleMap = new Map(createdPeople.map((p) => [p.publicProfileUrl, p]));

          const selectedIds = new Set(selectedContacts.map((c) => c.id));

          setContacts((prevAccounts) =>
            prevAccounts.map((acc) => {
              if (!selectedIds.has(acc.id)) return acc;

              const created = createdPeopleMap.get(acc.publicProfileUrl);
              console.log('mergeSelectedContacts created', created);
              return {
                ...acc,
                isAlreadyInCrm: true,
                ...(created && {
                  email: created.email ?? acc.email,
                  lastCompany: created.lastCompany ?? acc.lastCompany,
                }),
              };
            })
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

  const disconnectAccount = async () => {
    try {
      setLoadingStates((prev) => ({ ...prev, disconnect: true }));
      const res = await disconnectSocialAccount({ provider: activeTab });
      if (res) {
        setLoadingStates((prev) => ({ ...prev, disconnect: false }));
        setContacts([]);
        setNextCursor(null);
        setShowSyncButton(false);
        fetchLeadUserAccounts();
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

  const pollForEnrichedEmail = async (contactId: string, enrichmentId: string) => {
    const MAX_ATTEMPTS = 10;
    const DELAY_MS = 10000;
    console.log('Polling for enriched email with enrichmentId:', enrichmentId);
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      await new Promise((resolve) => setTimeout(resolve, DELAY_MS));

      try {
        const result = await getEnrichmentEmail(enrichmentId);

        if (result?.email) {
          setAccountDetailList((prev) =>
            prev.map((c) =>
              c?.id === contactId ? { ...c, email: result.email, leadAccount: result.lastCompany, emailStatus: 'found' } : c
            )
          );
          return;
        }
        console.log('result ', result);
        if (result?.status === 'COMPLETED') {
          setAccountDetailList((prev) =>
            prev.map((c) =>
              c?.id === contactId ? { ...c, emailStatus: 'not_found' } : c
            )
          );
          return;
        }
      } catch {
        // continua el polling si hay error puntual
      }
    }

    setAccountDetailList((prev) =>
      prev.map((c) =>
        c?.id === contactId ? { ...c, emailStatus: 'not_found' } : c
      )
    );
  };

  const fetchContactDetails = async (contactId: string, profileUrl: string) => {
    setSelectedAccountDetail(contactId);
    setLoadingStates((prev) => ({ ...prev, details: true }));
    const currentSocialAccountId = leadAccount ? leadAccount.id : '';
    const contact = await getContactDetail({
      contactId,
      accountId: currentSocialAccountId,
      profileUrl
    });
    setLoadingStates((prev) => ({ ...prev, details: false }));
    setAccountDetailList((prev) => [...prev, contact]);
    console.log('fetchContactDetails contact ', contact);
    if (contact?.emailStatus === 'enriching' && contact?.enrichmentId) {
      pollForEnrichedEmail(contactId, contact.enrichmentId);
    }

    return contact;
  };

  useEffect(() => {

  const handleOAuthCallback = async (): Promise<void> => {
      const urlParams = new URLSearchParams(window.location.search);
      const accountId = urlParams.get('account_id');
      fetchLeadUserAccounts();
      setActiveTab(accountId ? 'email' : 'linkedin');
    };
    handleOAuthCallback();
  }, []);


  useEffect(() => {
    fetchContacts();
  }, [activeTab]);

  return {
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
    setContacts,
    activeTab,
    setActiveTab,
    fetchLeadUserAccounts
  };
};
