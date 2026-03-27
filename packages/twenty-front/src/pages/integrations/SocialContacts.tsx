import { H3Title } from 'twenty-ui/display';
import { Button } from 'twenty-ui/input';
import { SocialContactsTabContent } from '~/pages/integrations/components/social-contact-tab-content';
import { WhatsAppConnectButton } from '~/pages/integrations/components/WhatsAppConnectButton';
import { useMicrosoftEmail } from '~/pages/integrations/hooks/useMicrosoftEmail';
import LinkedInConnectForm from '~/pages/integrations/LinkedInConnectForm';
import { useLinkedInContacts } from './hooks/useLinkedInContacts';
import * as S from './SocialContacts.styles';

export const SocialContacts = () => {
  const {
    contacts,
    nextCursor,
    leadAccount,
    selectedCount,
    showSyncButton,
    setApproveCode,
    businessMap,
    accountDetailList,
    selectedAccountDetail,
    isLoading,
    fetchContacts,
    loadMoreContacts,
    mergeSelectedContacts,
    disconnectAccount,
    verifyAccount,
    connectAccount,
    toggleContactSelection,
    fetchContactDetails,
    activeTab,
    setActiveTab,
    fetchLeadUserAccounts,
  } = useLinkedInContacts();

  const {
    isConnected: isMicrosoftConnected,
    isLoading: isMicrosoftLoading,
    connectMicrosoft,
  } = useMicrosoftEmail();
  return (
    <S.StyledContainer>
      <S.StyledCardWrapper>
        <H3Title title="Merge Social media contacts"></H3Title>

        <S.StyledTabBar role="tablist" aria-label="Merge Social media contacts">
          <S.StyledTabButton
            $active={activeTab === 'linkedin'}
            role="tab"
            aria-selected={activeTab === 'linkedin'}
            onClick={() => setActiveTab('linkedin')}
          >
            <H3Title title="LinkedIn"></H3Title>
          </S.StyledTabButton>

          <S.StyledTabButton
            $active={activeTab === 'whatsapp'}
            role="tab"
            aria-selected={activeTab === 'whatsapp'}
            onClick={() => setActiveTab('whatsapp')}
          >
            <H3Title title="WhatsApp"></H3Title>
          </S.StyledTabButton>

          <S.StyledTabButton
            $active={activeTab === 'email'}
            role="tab"
            aria-selected={activeTab === 'email'}
            onClick={() => setActiveTab('email')}
          >
            <H3Title title="Microsoft Outlook"></H3Title>
          </S.StyledTabButton>
        </S.StyledTabBar>

        <S.TabContent>
          {activeTab === 'linkedin' && (
            <>
              <S.HeaderContactContainer>
                <S.SocialValidationContainer>
                  {!contacts.length && (
                    <S.StyledMessage>
                      Connect your LinkedIn account
                    </S.StyledMessage>
                  )}
                  {!contacts?.length && showSyncButton && (
                    <S.SocialVerifyContainer>
                      <S.SectionSubtitle>
                        Check the code by email or accept approval via the app.
                      </S.SectionSubtitle>
                      <S.SocialVerifyInputsContainer>
                        <S.InputApproveCodeContainer>
                          <input
                            type="text"
                            placeholder="Insert Approve Code"
                            onChange={(e) => setApproveCode(e.target.value)}
                          />
                          <Button
                            isLoading={isLoading.verify}
                            title="Check code"
                            onClick={() => verifyAccount('linkedin')}
                          />
                        </S.InputApproveCodeContainer>
                        <S.SectionSubtitle>Or</S.SectionSubtitle>
                        <div>
                          <Button
                            isLoading={isLoading.verify}
                            title="Check Approve by App"
                            onClick={() => fetchContacts()}
                          />
                        </div>
                      </S.SocialVerifyInputsContainer>
                    </S.SocialVerifyContainer>
                  )}
                  {!contacts?.length && !showSyncButton ? (
                    <LinkedInConnectForm
                      onConnectSocialAccount={connectAccount}
                      socialLoading={isLoading.connect}
                    />
                  ) : null}
                </S.SocialValidationContainer>
              </S.HeaderContactContainer>

              <SocialContactsTabContent
                contacts={contacts}
                isLoading={isLoading}
                leadAccount={leadAccount}
                selectedCount={selectedCount}
                disconnectAccount={disconnectAccount}
                mergeSelectedContacts={mergeSelectedContacts}
                toggleContactSelection={toggleContactSelection}
                fetchContactDetails={fetchContactDetails}
                accountDetailList={accountDetailList}
                businessMap={businessMap}
                selectedAccountDetail={selectedAccountDetail}
                nextCursor={nextCursor}
                loadMoreContacts={loadMoreContacts}
                contactLabel="LinkedIn contact"
                label="LinkedIn contacts"
              />
            </>
          )}

          {activeTab === 'whatsapp' && (
            <>
              {!contacts.length ? (
                <WhatsAppConnectButton
                  fetchContacts={fetchContacts}
                  fetchLeadUserAccounts={fetchLeadUserAccounts}
                />
              ) : (
                <SocialContactsTabContent
                  contacts={contacts}
                  isLoading={isLoading}
                  leadAccount={leadAccount}
                  selectedCount={selectedCount}
                  disconnectAccount={disconnectAccount}
                  mergeSelectedContacts={mergeSelectedContacts}
                  toggleContactSelection={toggleContactSelection}
                  fetchContactDetails={null}
                  accountDetailList={accountDetailList}
                  businessMap={businessMap}
                  selectedAccountDetail={selectedAccountDetail}
                  nextCursor={nextCursor}
                  loadMoreContacts={loadMoreContacts}
                  contactLabel="WhatsApp contact"
                  label="WhatsApp contacts"
                  refresh={fetchContacts}
                />
              )}
            </>
          )}

          {activeTab === 'email' && (
            <>
              {!contacts.length && !leadAccount && !isMicrosoftConnected ? (
                <div>
                  <S.StyledMessage>
                    Connect your Microsoft Outlook account to access emails
                  </S.StyledMessage>
                  <Button
                    isLoading={isMicrosoftLoading}
                    title="Connect Microsoft Outlook"
                    onClick={() =>
                      connectMicrosoft(
                        `${window.location.origin}/integrations/social-contacts`,
                      )
                    }
                  />
                </div>
              ) : (
                <SocialContactsTabContent
                  contacts={contacts}
                  isLoading={isLoading}
                  leadAccount={leadAccount}
                  selectedCount={selectedCount}
                  disconnectAccount={disconnectAccount}
                  mergeSelectedContacts={mergeSelectedContacts}
                  toggleContactSelection={toggleContactSelection}
                  fetchContactDetails={null}
                  accountDetailList={accountDetailList}
                  businessMap={businessMap}
                  selectedAccountDetail={selectedAccountDetail}
                  nextCursor={nextCursor}
                  loadMoreContacts={loadMoreContacts}
                  contactLabel="Microsoft Outlook contact"
                  label="Microsoft Outlook contacts"
                />
              )}
            </>
          )}
        </S.TabContent>
      </S.StyledCardWrapper>
    </S.StyledContainer>
  );
};

export default SocialContacts;
