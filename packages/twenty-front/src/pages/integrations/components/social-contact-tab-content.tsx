import { H2Title, H3Title } from 'twenty-ui/display';
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
  fetchContactDetails?: ((id: string, profileUrl: string) => void) | null;
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
                      <H3Title title='Account Details' ></H3Title>
                      <H2Title title={`Username: ${leadAccount?.username ?? ''}`} ></H2Title>
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
                          onShowDetails={fetchContactDetails ? () => fetchContactDetails(account.id, account.publicProfileUrl || '') : null}
                          contactLabel={contactLabel}
                        />
                      ))}
                    </S.ContactList>
                    {nextCursor && (
                      <S.LoadMoreButtonContainer>
                        <Button
                          isLoading={isLoading.loadMore}
                          title="Load More Contacts"
                          onClick={loadMoreContacts}
                        />
                      </S.LoadMoreButtonContainer>
                    )}
                  </S.BodyContactDetailsContainer>
                </S.BodyContactContainer>
              )}
    </div>
  );
};
