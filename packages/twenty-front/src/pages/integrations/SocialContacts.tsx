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
  InputApproveCodeContainer,
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
  TabContent,
} from './SocialContacts.styles';

export interface SocialContactList {
  id: string;
  firstName: string;
  lastName: string;
  profilePictureUrl?: string;
  publicProfileUrl?: string;
}

export const SocialContacts = () => {
  const {
    getLinkedinAccountDetails: getLinkedinAccountDetailsApi,
    getLeadUserAccounts: getLeadUserAccountsApi,
    loginSocialAccount,
    validateSocialAccount,
    disconnectSocialAccount,
    storeContactsToPeople
  } = useSocialContactService();
  const [activeTab, setActiveTab] = useState<'linkedin' | 'whatsapp' | 'gmail'>('linkedin');
  const [showSyncLinkedinButton, setShowSyncLinkedinButton] = useState(false);
  const [approveCode, setApproveCode] = useState<string>('');
  const [accounts, setAccounts] = useState<SocialContactList[]>([]);
  const [leadUserSocialAccounts, setLeadUserSocialAccounts] = useState<any[]>(
    [],
  );
  const [businessMap, setBusinessMap] = useState<Record<string, boolean>>({});
  const [mergeAccountsLoading, setMergeAccountsLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState(false);
  const [disconnectLoading, setDisconnectLoading] = useState(false);
  const [socialVerifyLoading, setSocialVerifyLoading] = useState(false);

  const mergeContactsToPeople = async () => {
    const selectedContacts = accounts.filter(
      (acc) => acc?.id && !!businessMap[acc.id],
    );
    try {
      setMergeAccountsLoading(true);
      const res = await storeContactsToPeople({ selectedContacts });
      setMergeAccountsLoading(false);
      setBusinessMap({});
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
      setShowSyncLinkedinButton(false);
      }

    } catch (error) {
      setDisconnectLoading(false);
    }
  };

  const getLinkedinAccountDetails = async () => {
    try {
      setSocialVerifyLoading(true);
      const accountsData = await getLinkedinAccountDetailsApi('linkedin');
      if (accountsData.length) {
        setSocialVerifyLoading(false);
        setAccounts(accountsData);
        setBusinessMap((prev) => {
          const next = { ...prev };
          accountsData.forEach((acc: any) => {
            if (!acc?.id) return;
            if (typeof next[acc.id] === 'undefined') next[acc.id] = false;
          });
          return next;
        });
        setShowSyncLinkedinButton(true);
      } else {
        setShowSyncLinkedinButton(false);
      }
      setSocialVerifyLoading(false);

      return accountsData ?? null;
    } catch (error) {
      setShowSyncLinkedinButton(false);
      setSocialVerifyLoading(false);
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
                      {accounts.map((account, index) => (
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
                          </ContactInfo>

                          <SwitchContainer>
                            <SwitchButton
                              $active={!!businessMap[account.id]}
                              aria-pressed={!!businessMap[account.id]}
                              onClick={() => toggleBusiness(account.id)}
                            >
                              {businessMap[account.id]
                                ? 'Business account selected'
                                : 'Not Selected'}
                            </SwitchButton>
                          </SwitchContainer>
                        </ContactItem>
                      ))}
                    </ContactList>
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
