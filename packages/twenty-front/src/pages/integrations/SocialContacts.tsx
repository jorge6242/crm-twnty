import { useEffect, useMemo, useState } from 'react';
import { Button } from 'twenty-ui/input';
import { useSocialContactService } from '~/hooks/services/use-social-contact.service';
import LinkedInConnectForm from '~/pages/integrations/LinkedInConnectForm';
import {
  Avatar,
  BodyContactContainer,
  BodyContactDetails,
  ContactInfo,
  ContactItem,
  ContactList,
  HeaderContactContainer,
  Headline,
  InputApproveCodeContainer,
  LastJob,
  Name,
  ProfileLink,
  SectionSubtitle,
  SectionTitle,
  SocialValidationContainer,
  SocialVerifyContainer,
  SocialVerifyInputsContainer,
  StyledCardWrapper,
  StyledContainer,
  StyledMessage,
  StyledTabBar,
  StyledTabButton,
  StyledTitle,
  SwitchButton,
  SwitchContainer,
  TabContent
} from './SocialContacts.styles';

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

export const SocialContacts = () => {
  const {
    getLinkedinAccountDetails: getLinkedinAccountDetailsApi,
    getLeadUserAccounts: getLeadUserAccountsApi,
    loginSocialAccount,
    validateSocialAccount,
    disconnectSocialAccount,
    storeContactsToPeople,
    getContactDetail
  } = useSocialContactService();
  const [activeTab, setActiveTab] = useState<'linkedin' | 'whatsapp' | 'gmail'>('linkedin');
  const [showSyncLinkedinButton, setShowSyncLinkedinButton] = useState(false);
  const [approveCode, setApproveCode] = useState<string>('');
  const [accounts, setAccounts] = useState<SocialContactList[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [leadUserSocialAccounts, setLeadUserSocialAccounts] = useState<any[]>([]);
  const [businessMap, setBusinessMap] = useState<Record<string, boolean>>({});
  const [mergeAccountsLoading, setMergeAccountsLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState(false);
  const [disconnectLoading, setDisconnectLoading] = useState(false);
  const [socialVerifyLoading, setSocialVerifyLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isAccountDetailLoading, setIsAccountDetailLoading] = useState(false);
  const [selectedAccountDetail, setSelectedAccountDetail] = useState<string | null>(null);
  const [accountDetailList, setAccountDetailList] = useState<any[]>([]);

  const mergeContactsToPeople = async () => {
    const selectedContacts = accounts.filter(
      (acc) => acc?.id && !!businessMap[acc.id],
    );

    if (selectedContacts.length === 0) {
      return null;
    }

    try {
      setMergeAccountsLoading(true);
      const res = await storeContactsToPeople({ selectedContacts });

      if (res) {
        // Update local state: mark synchronized contacts as already in CRM
        const selectedIds = new Set(selectedContacts.map(c => c.id));
        setAccounts(prevAccounts =>
          prevAccounts.map(acc =>
            selectedIds.has(acc.id)
              ? { ...acc, isAlreadyInCrm: true }
              : acc
          )
        );

        // Clear businessMap for synchronized contacts
        setBusinessMap(prevMap => {
          const newMap = { ...prevMap };
          selectedIds.forEach(id => delete newMap[id]);
          return newMap;
        });
      }

      setMergeAccountsLoading(false);
      return res ?? null;
    } catch (error) {
      setMergeAccountsLoading(false);
      return null;
    }
  };

  const getLeadUserAccount = (type: string) => {
    switch (type) {
      case 'linkedin':
        return leadUserSocialAccounts.find((e) => e.source === 'linkedin');
      default:
        return null;
    }
  };

  const getLeadUserAccounts = async () => {
    try {
      const data = await getLeadUserAccountsApi();
      setLeadUserSocialAccounts(data);
      return data;
    } catch (error) {
      return [];
    }
  };

  const onDisconnectAccount = async (provider: string) => {
    try {
      setDisconnectLoading(true);
      const res = await disconnectSocialAccount({ provider });
      if(res){
      setDisconnectLoading(false);
      setAccounts([]);
      setNextCursor(null);
      setShowSyncLinkedinButton(false);
      }

    } catch (error) {
      setDisconnectLoading(false);
    }
  };

  const getLinkedinAccountDetails = async (cursor?: string) => {
    try {
      if (cursor) {
        setIsLoadingMore(true);
      } else {
        setSocialVerifyLoading(true);
      }

      const response = await getLinkedinAccountDetailsApi('linkedin', cursor);
      const accountsData = response?.contacts ?? [];
      const newCursor = response?.nextCursor ?? null;

      if (accountsData.length) {
        setAccounts((prev) => cursor ? [...prev, ...accountsData] : accountsData);
        setNextCursor(newCursor);
        setBusinessMap((prev) => {
          const next = { ...prev };
          accountsData.forEach((acc: any) => {
            if (!acc?.id) return;
            if (typeof next[acc.id] === 'undefined') next[acc.id] = false;
          });
          return next;
        });
        setShowSyncLinkedinButton(true);
      } else if (!cursor) {
        setShowSyncLinkedinButton(false);
      }

      setSocialVerifyLoading(false);
      setIsLoadingMore(false);

      return accountsData ?? null;
    } catch (error) {
      if (!cursor) {
        setShowSyncLinkedinButton(false);
      }
      setSocialVerifyLoading(false);
      setIsLoadingMore(false);
      return null;
    }
  };

  const verifyLinkedAccount = async (provider: string) => {
    setSocialVerifyLoading(true);
    try {
      await validateSocialAccount({ provider, code: approveCode });
      const account = await getLinkedinAccountDetails();
      if (account && account.status === 'linked') {
        setSocialVerifyLoading(false);
        setShowSyncLinkedinButton(true);
      } else {
        setShowSyncLinkedinButton(false);
      }
    } catch (error) {
      setShowSyncLinkedinButton(false);
    } finally {
      setSocialVerifyLoading(false);
    }
  };

  const onConnectSocialAccount = async ({
    username,
    password,
  }: {
    username: string;
    password: string;
  }) => {
    setSocialLoading(true);
    const result = await loginSocialAccount({ username, password });
    if (result) {
      setShowSyncLinkedinButton(true);
      setSocialLoading(false);
    } else {
      setSocialLoading(false);
    }
  };

  const toggleBusiness = (key: string) => {
    setBusinessMap((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const onShowContactDetails = async (contactId: string, accountId: string) => {
    setSelectedAccountDetail(contactId);
    setIsAccountDetailLoading(true);
    const currentSocialAccountId =  getLeadUserAccount('linkedin') ? getLeadUserAccount('linkedin').id : ''

    const contact = await getContactDetail({ contactId, accountId: currentSocialAccountId });
    setIsAccountDetailLoading(false);
    setAccountDetailList(prev => [...prev, contact]);
    console.log(contact);
  };

  useEffect(() => {
    getLinkedinAccountDetails();
    getLeadUserAccounts();
  }, []);

  const selectedCount = useMemo(() => Object.values(businessMap).filter(Boolean).length,[businessMap]);

  return (
    <StyledContainer>
      <StyledCardWrapper>
        <StyledTitle>Integration of social media contacts</StyledTitle>

        <StyledTabBar
          role="tablist"
          aria-label="Integraciones de redes sociales"
        >
          <StyledTabButton
            $active={activeTab === 'linkedin'}
            role="tab"
            aria-selected={activeTab === 'linkedin'}
            onClick={() => setActiveTab('linkedin')}
          >
            LinkedIn
          </StyledTabButton>

          <StyledTabButton
            $active={activeTab === 'whatsapp'}
            role="tab"
            aria-selected={activeTab === 'whatsapp'}
            onClick={() => setActiveTab('whatsapp')}
          >
            WhatsApp
          </StyledTabButton>

          <StyledTabButton
            $active={activeTab === 'gmail'}
            role="tab"
            aria-selected={activeTab === 'gmail'}
            onClick={() => setActiveTab('gmail')}
          >
            Gmail
          </StyledTabButton>
        </StyledTabBar>

        <TabContent>
          {activeTab === 'linkedin' && (
            <>
              <HeaderContactContainer>
                <SocialValidationContainer>
                  {!accounts.length && (
                    <StyledMessage>Connect your LinkedIn account</StyledMessage>
                  )}
                  {!accounts?.length && showSyncLinkedinButton && (
                    <SocialVerifyContainer>
                      <SectionSubtitle>
                        Check the code by email or accept approval via the app.
                      </SectionSubtitle>
                      <SocialVerifyInputsContainer>
                        <InputApproveCodeContainer>
                          <input
                            type="text"
                            placeholder="Insert Approve Code"
                            onChange={(e) => setApproveCode(e.target.value)}
                          />
                          <Button
                            isLoading={socialVerifyLoading}
                            title="Check code"
                            onClick={() => verifyLinkedAccount('linkedin')}
                          />
                        </InputApproveCodeContainer>
                        <SectionSubtitle>Or</SectionSubtitle>
                        <div>
                          <Button
                            isLoading={socialVerifyLoading}
                            title="Check Approve by App"
                            onClick={() => getLinkedinAccountDetails()}
                          />
                        </div>
                      </SocialVerifyInputsContainer>
                    </SocialVerifyContainer>
                  )}
                  {!accounts?.length && !showSyncLinkedinButton && (
                    <LinkedInConnectForm
                      onConnectSocialAccount={onConnectSocialAccount}
                      socialLoading={socialLoading}
                    />
                  )}
                </SocialValidationContainer>
              </HeaderContactContainer>

              {accounts.length && (
                <BodyContactContainer>
                  <BodyContactDetails>
                    <div>
                      <SectionTitle>Account Details</SectionTitle>
                      <SectionSubtitle>
                        Username:{' '}
                        {getLeadUserAccount('linkedin')
                          ? getLeadUserAccount('linkedin').username
                          : ''}
                      </SectionSubtitle>
                      <Button
                        isLoading={disconnectLoading}
                        title="Disconnect Account"
                        onClick={() => onDisconnectAccount('linkedin')}
                      />
                    </div>
                    {selectedCount > 0 && (
                      <div>
                        <Button
                          isLoading={mergeAccountsLoading}
                          title={`Merge ${selectedCount} Contacts to People`}
                          onClick={() => mergeContactsToPeople()}
                        />
                      </div>
                    )}
                  </BodyContactDetails>

                  <div>
                    <ContactList role="list" aria-label="LinkedIn contacts">
                      {accounts.map((account, index) => {
                        const currentAccountDetail   = accountDetailList.find((accountDetail) => accountDetail.id === account.id);
                        return (
                        <ContactItem
                          key={account.id}
                          role="listitem"
                          aria-label={`LinkedIn contact ${account.firstName ?? ''} ${account.lastName ?? ''}`}
                        >
                          <Avatar
                            src={
                              account.profilePictureUrl ??
                              '/placeholder-avatar.png'
                            }
                            alt={`${account.firstName ?? ''} ${account.lastName ?? ''}`}
                          />
                          <ContactInfo>
                            <Name>
                                {account.firstName ?? ''} {account.lastName ?? ''}
                              </Name>
                              <Headline>{account.headline}</Headline>
                            {account.publicProfileUrl ? (
                              <ProfileLink
                                href={account.publicProfileUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                >
                                {account.publicProfileUrl}
                              </ProfileLink>
                            ) : (
                              <ProfileLink as="span" aria-hidden="true">
                                No profile URL
                              </ProfileLink>
                            )}
                            {
                              currentAccountDetail ? (
                                <LastJob>
                                  <p>Company: {currentAccountDetail?.lastCompany?.name}</p>
                                  <p>Position: {currentAccountDetail?.lastCompany?.position}</p>
                                  <p>Email: {currentAccountDetail?.email}</p>
                                </LastJob>
                              ) : (
                                <Button
                                  isLoading={isAccountDetailLoading && selectedAccountDetail === account.id}
                                  title="Show Details"
                                  onClick={() => onShowContactDetails(account.id, account.id)}
                                />
                              )
                            }

                          </ContactInfo>

                          <SwitchContainer>
                             <SwitchButton
                               $active={!!businessMap[account.id] || account.isAlreadyInCrm}
                               aria-pressed={!!businessMap[account.id] || account.isAlreadyInCrm}
                               onClick={() => !account.isAlreadyInCrm && toggleBusiness(account.id)}
                               style={{ cursor: account.isAlreadyInCrm ? 'default' : 'pointer', opacity: account.isAlreadyInCrm ? 0.7 : 1 }}
                             >
                               {account.isAlreadyInCrm
                                 ? 'Synchronized'
                                 : businessMap[account.id]
                                   ? 'Business account selected'
                                   : 'Not Selected'}
                             </SwitchButton>
                          </SwitchContainer>
                        </ContactItem>
                      )
                      })}
                    </ContactList>
                    {nextCursor && (
                      <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'center' }}>
                        <Button
                          isLoading={isLoadingMore}
                          title="Load More Contacts"
                          onClick={() => getLinkedinAccountDetails(nextCursor)}
                        />
                      </div>
                    )}
                  </div>
                </BodyContactContainer>
              )}
            </>
          )}

          {activeTab === 'whatsapp' && (
            <StyledMessage>
              WhatsApp — Demo mode: integration coming soon.
            </StyledMessage>
          )}

          {activeTab === 'gmail' && (
            <StyledMessage>
              WhatsApp — Demo mode: integration coming soon.
            </StyledMessage>
          )}
        </TabContent>
      </StyledCardWrapper>
    </StyledContainer>
  );
};

export default SocialContacts;
