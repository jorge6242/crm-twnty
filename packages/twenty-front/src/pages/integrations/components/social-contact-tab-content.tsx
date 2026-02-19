import { Loader } from 'twenty-ui/feedback';
import { Button } from 'twenty-ui/input';
import { SocialContactListItem } from '~/pages/integrations/components/SocialContactListItem';
import { SocialContactList } from "../hooks/useLinkedInContacts";
import * as S from '../SocialContacts.styles';


interface TabContentProps {
  contacts: SocialContactList[];
  selectedCount: number;
  isLoading: any;
  disconnectAccount: () => void;
  mergeSelectedContacts: () => void;
  toggleContactSelection: (id: string) => void;
  fetchContactDetails?: ((id: string, accountId: string) => void) | null;
  accountDetailList: any[];
  businessMap: Record<string, boolean>;
  selectedAccountDetail: string | null;
  nextCursor: string | null;
  loadMoreContacts: () => void;
  leadAccount: any;
  contactLabel: string;
  label: string;
  refresh?: (() => void) | null;
}


export const SocialContactsTabContent = ({label, contactLabel, contacts, isLoading, leadAccount, selectedCount, disconnectAccount, mergeSelectedContacts, toggleContactSelection, fetchContactDetails, accountDetailList, businessMap, selectedAccountDetail, nextCursor, loadMoreContacts, refresh }: TabContentProps) => {
  if (isLoading.verify) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}>
        <Loader color="gray" />
      </div>
    );
  }
  return (
    <div>
            {contacts.length && (
                <S.BodyContactContainer>
                  <S.BodyContactDetails>
                    <S.BodyContactDetails2>
                      <S.SectionTitle>Account Details</S.SectionTitle>
                      <S.SectionSubtitle> Username: {leadAccount?.username ?? ''}</S.SectionSubtitle>
                    </S.BodyContactDetails2>
                    <S.StyledActionButtons>
                      <Button
                        isLoading={isLoading.disconnect}
                        title="Disconnect Account"
                        onClick={() => disconnectAccount()}
                      />
                      {refresh && (
                        <div>
                          <Button
                            title="Refresh"
                            onClick={() => refresh()}
                          />
                        </div>
                      )}
                    <Button
                      isLoading={isLoading.merge}
                      title={`Merge ${selectedCount} Contacts to People`}
                      onClick={() => mergeSelectedContacts()}
                      disabled={selectedCount === 0}
                    />
                    </S.StyledActionButtons>

                  </S.BodyContactDetails>

                  <S.BodyContactDetailsContainer>
                    <S.ContactList role="list" aria-label={label}>
                      {contacts.map((account) => (
                        <SocialContactListItem
                          key={account.id}
                          contact={account}
                          contactDetail={accountDetailList.find((d) => d.id === account.id)}
                          isSelected={!!businessMap[account.id]}
                          isAlreadyInCrm={!!account.isAlreadyInCrm}
                          isDetailsLoading={isLoading.details && selectedAccountDetail === account.id}
                          onToggleSelection={() => toggleContactSelection(account.id)}
                          onShowDetails={fetchContactDetails ? () => fetchContactDetails(account.id, account.id) : null}
                          contactLabel={contactLabel}
                        />
                      ))}
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
                  </S.BodyContactDetailsContainer>
                </S.BodyContactContainer>
              )}
    </div>
  );
};
