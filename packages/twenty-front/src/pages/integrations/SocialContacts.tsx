import { useState } from 'react';
import { Button } from 'twenty-ui/input';
import LinkedInConnectForm from '~/pages/integrations/LinkedInConnectForm';
import { useLinkedInContacts } from './hooks/useLinkedInContacts';
import * as S from './SocialContacts.styles';

export const SocialContacts = () => {
  const [activeTab, setActiveTab] = useState<'linkedin' | 'whatsapp' | 'gmail'>('linkedin');

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
  } = useLinkedInContacts();

  return (
    <S.StyledContainer>
      <S.StyledCardWrapper>
        <S.StyledTitle>Integration of social media contacts</S.StyledTitle>

        <S.StyledTabBar
          role="tablist"
          aria-label="Integraciones de redes sociales"
        >
          <S.StyledTabButton
            $active={activeTab === 'linkedin'}
            role="tab"
            aria-selected={activeTab === 'linkedin'}
            onClick={() => setActiveTab('linkedin')}
          >
            LinkedIn
          </S.StyledTabButton>

          <S.StyledTabButton
            $active={activeTab === 'whatsapp'}
            role="tab"
            aria-selected={activeTab === 'whatsapp'}
            onClick={() => setActiveTab('whatsapp')}
          >
            WhatsApp
          </S.StyledTabButton>

          <S.StyledTabButton
            $active={activeTab === 'gmail'}
            role="tab"
            aria-selected={activeTab === 'gmail'}
            onClick={() => setActiveTab('gmail')}
          >
            Gmail
          </S.StyledTabButton>
        </S.StyledTabBar>

        <S.TabContent>
          {activeTab === 'linkedin' && (
            <>
              <S.HeaderContactContainer>
                <S.SocialValidationContainer>
                  {!contacts.length && (
                    <S.StyledMessage>Connect your LinkedIn account</S.StyledMessage>
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
                  {!contacts?.length && !showSyncButton && (
                    <LinkedInConnectForm
                      onConnectSocialAccount={connectAccount}
                      socialLoading={isLoading.connect}
                    />
                  )}
                </S.SocialValidationContainer>
              </S.HeaderContactContainer>

              {contacts.length && (
                <S.BodyContactContainer>
                  <S.BodyContactDetails>
                    <div>
                      <S.SectionTitle>Account Details</S.SectionTitle>
                      <S.SectionSubtitle>
                        Username:
                        {leadAccount?.username ?? ''}
                      </S.SectionSubtitle>
                      <Button
                        isLoading={isLoading.disconnect}
                        title="Disconnect Account"
                        onClick={() => disconnectAccount('linkedin')}
                      />
                    </div>
                    {selectedCount > 0 && (
                      <div>
                        <Button
                          isLoading={isLoading.merge}
                          title={`Merge ${selectedCount} Contacts to People`}
                          onClick={() => mergeSelectedContacts()}
                        />
                      </div>
                    )}
                  </S.BodyContactDetails>

                  <div>
                    <S.ContactList role="list" aria-label="LinkedIn contacts">
                      {contacts.map(account => {
                        const currentAccountDetail   = accountDetailList.find((accountDetail) => accountDetail.id === account.id);
                        return (
                        <S.ContactItem
                          key={account.id}
                          role="listitem"
                          aria-label={`LinkedIn contact ${account.firstName ?? ''} ${account.lastName ?? ''}`}
                        >
                          <S.Avatar
                            src={
                              account.profilePictureUrl ??
                              '/placeholder-avatar.png'
                            }
                            alt={`${account.firstName ?? ''} ${account.lastName ?? ''}`}
                          />
                          <S.ContactInfo>
                            <S.Name>
                                {account.firstName ?? ''} {account.lastName ?? ''}
                              </S.Name>
                              <S.Headline>{account.headline}</S.Headline>
                            {account.publicProfileUrl ? (
                              <S.ProfileLink
                                href={account.publicProfileUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                >
                                {account.publicProfileUrl}
                              </S.ProfileLink>
                            ) : (
                              <S.ProfileLink as="span" aria-hidden="true">
                                No profile URL
                              </S.ProfileLink>
                            )}
                            {
                              currentAccountDetail ? (
                                <S.LastJob>
                                  <p>Company: {currentAccountDetail?.lastCompany?.name}</p>
                                  <p>Position: {currentAccountDetail?.lastCompany?.position}</p>
                                  <p>Email: {currentAccountDetail?.email}</p>
                                </S.LastJob>
                              ) : (
                                <Button
                                  isLoading={isLoading.details && selectedAccountDetail === account.id}
                                  title="Show Details"
                                  onClick={() => fetchContactDetails(account.id, account.id)}
                                />
                              )
                            }

                          </S.ContactInfo>

                          <S.SwitchContainer>
                             <S.SwitchButton
                               $active={!!businessMap[account.id] || account.isAlreadyInCrm}
                               aria-pressed={!!businessMap[account.id] || account.isAlreadyInCrm}
                               onClick={() => !account.isAlreadyInCrm && toggleContactSelection(account.id)}
                               style={{ cursor: account.isAlreadyInCrm ? 'default' : 'pointer', opacity: account.isAlreadyInCrm ? 0.7 : 1 }}
                             >
                               {account.isAlreadyInCrm
                                 ? 'Synchronized'
                                 : businessMap[account.id]
                                   ? 'Business account selected'
                                   : 'Not Selected'}
                             </S.SwitchButton>
                          </S.SwitchContainer>
                        </S.ContactItem>
                      )
                      })}
                    </S.ContactList>
                    {nextCursor && (
                      <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'center' }}>
                        <Button
                          isLoading={isLoading.loadMore}
                          title="Load More Contacts"
                          onClick={loadMoreContacts}
                        />
                      </div>
                    )}
                  </div>
                </S.BodyContactContainer>
              )}
            </>
          )}

          {activeTab === 'whatsapp' && (
            <S.StyledMessage>
              WhatsApp — Demo mode: integration coming soon.
            </S.StyledMessage>
          )}

          {activeTab === 'gmail' && (
            <S.StyledMessage>
              WhatsApp — Demo mode: integration coming soon.
            </S.StyledMessage>
          )}
        </S.TabContent>
      </S.StyledCardWrapper>
    </S.StyledContainer>
  );
};

export default SocialContacts;
