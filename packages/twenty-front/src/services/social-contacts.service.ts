import { ApolloClient, gql } from '@apollo/client';
import { SocialContactList } from '~/pages/integrations/hooks/useLinkedInContacts';


export async function getLinkedinAccountDetails<TCache = any>(client: ApolloClient<TCache>, provider = 'linkedin', cursor?: string) {
  const QQLQuery = gql`
    query GetLinkedSocialAccount($provider: String!, $cursor: String) {
      linkedSocialAccount(provider: $provider, cursor: $cursor)
        @rest(
          type: "LinkedAccountResponse"
          path: "/metadata/social-accounts/{args.provider}{args.cursor}"
          method: "GET"
        ) {
        contacts @type(name: "LinkedAccount") {
          id
          firstName
          lastName
          email
          publicProfileUrl
          profilePictureUrl
          headline
          isAlreadyInCrm
          personId
        }
        nextCursor
      }
    }
  `;
      const formattedCursor = (cursor && cursor !== 'null' && cursor !== 'undefined') ? `?cursor=${cursor}` : '';
      const { data } = await client.query({
        query: QQLQuery,
        variables: { provider, cursor: formattedCursor },
        fetchPolicy: 'network-only',
        context: { fetchOptions: { cache: 'no-store' } },
      });

  return data?.linkedSocialAccount ?? { contacts: [], nextCursor: null };
}

export async function getLeadUserAccounts<TCache = any>(client: ApolloClient<TCache>) {
  const QQLQuery = gql`
    query getLeadUserAccounts {
      linkedSocialAccounts
        @rest(type: "LinkedAccount", path: "/metadata/social-accounts/list", method: "GET") {
        id
        firstName
        lastName
        username
        source
      }
    }
  `;
  const { data } = await client.query({
    query: QQLQuery,
    fetchPolicy: 'network-only',
    context: { fetchOptions: { cache: 'no-store' } },
  });
  return data?.linkedSocialAccounts ?? [];
}

export async function loginSocialAccount<TCache = any>(client: ApolloClient<TCache>, payload: { username: string; password: string; }) {
    const { username, password } = payload;
    const QQLQuery = gql`
      mutation LinkSocialAccount($username: String!, $password: String!) {
        linkSocialAccount(input: { username: $username, password: $password })
          @rest(
            type: "LinkAccountResponse"
            path: "/metadata/social-accounts"
            method: "POST"
            bodyKey: "input"
          ) {
          message
        }
      }
    `;
      const { data } = await client.mutate({
        mutation: QQLQuery,
        variables: { username, password },
        context: { fetchOptions: { cache: 'no-store' } },
      });
    return data?.linkSocialAccount ?? null;
}

export async function validateSocialAccount<TCache = any>(client: ApolloClient<TCache>, payload: { provider: string; code: string; }) {
    const { provider, code } = payload;
    const QQLQuery = gql`
    mutation SolveCheckpoint($provider: String!, $code: String!) {
      solveCheckpoint(input: { provider: $provider, code: $code })
        @rest(
          type: "LinkAccountResponse"
          path: "/metadata/social-accounts/checkpoint"
          method: "POST"
          bodyKey: "input"
        ) {
        message
      }
    }
  `;
      const { data } = await client.mutate({
        mutation: QQLQuery,
        variables: { provider, code },
        context: { fetchOptions: { cache: 'no-store' } },
      });
    return data?.solveCheckpoint ?? null;
}

export async function disconnectSocialAccount<TCache = any>(client: ApolloClient<TCache>, payload: { provider: string}) {
    const { provider } = payload;
    const QQLQuery = gql`
      mutation DisconnectSocialAccount($provider: String!) {
        disconnectSocialAccount(provider: $provider)
          @rest(
            type: "DisconnectAccountResponse"
            path: "/metadata/social-accounts/disconnect/{args.provider}"
            method: "DELETE"
          ) {
          message
        }
      }
    `;
      const { data } = await client.mutate({
        mutation: QQLQuery,
        variables: { provider },
        context: { fetchOptions: { cache: 'no-store' } },
      });
    return data?.disconnectSocialAccount ?? null;
}

export async function storeContactsToPeople<TCache = any>(client: ApolloClient<TCache>, payload: { selectedContacts: SocialContactList[]}) {
    const { selectedContacts  } = payload;
    const QQLQuery = gql`
      mutation MergeContacts($contacts: [JSON!]!) {
        mergeContacts(input: { contacts: $contacts })
          @rest(
            type: "MergeContactsResponse"
            path: "/metadata/social-accounts/merge-contacts"
            method: "POST"
            bodyKey: "input"
          ) {
          message
          mergedCount
        }
      }
    `;
      const { data } = await client.mutate({
        mutation: QQLQuery,
        variables: { contacts: selectedContacts },
        context: { fetchOptions: { cache: 'no-store' } },
      })
    return data?.mergeContacts ?? null;
}

export async function getContactDetail<TCache = any>(client: ApolloClient<TCache>, payload: { contactId: string, accountId: string}) {
    const { contactId, accountId } = payload;
    const QQLQuery = gql`
      query GetContactDetail($contactId: String!, $accountId: String!) {
        getContactDetail(contactId: $contactId, accountId: $accountId)
          @rest(
            type: "GetContactDetailResponse"
            path: "/metadata/social-accounts/get-contact-detail/{args.contactId}/{args.accountId}"
            method: "GET"
          ) {
         email
         firstName
         lastName
         profilePictureUrl
         publicProfileUrl
         id
         lastCompany {
          name
          position
          location
          description
          startDate
          endDate
         }
        }
      }
    `;
      const { data } = await client.query({
        query: QQLQuery,
        variables: { contactId, accountId },
        context: { fetchOptions: { cache: 'no-store' } },
      })
    return data?.getContactDetail ?? null;
}

export async function initiateMicrosoftAuth<TCache = any>(
  client: ApolloClient<TCache>,
  redirectUrl: string
) {
  const MUTATION = gql`
    mutation InitiateMicrosoftAuth($input: JSON) {
      initiateMicrosoftAuth(input: $input) @rest(
        type: "MicrosoftAuthResponse"
        path: "/metadata/social-accounts/connect/microsoft"
        method: "POST"
        bodyKey: "input"
      ) {
        authUrl
        expiresAt
      }
    }
  `;

  const { data } = await client.mutate({
    mutation: MUTATION,
    variables: { input: { redirectUrl } }
  });
  const { authUrl } = data.initiateMicrosoftAuth;

  // Redirigir usuario a Unipile Hosted Auth
  window.location.href = authUrl;

  return data;
}
