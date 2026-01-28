import { currentWorkspaceMemberState } from '@/auth/states/currentWorkspaceMemberState';
import { gql, useApolloClient } from '@apollo/client';
import styled from '@emotion/styled';
import { useEffect, useRef, useState } from 'react';
import { useRecoilValue } from 'recoil';

const UNIPILE_HELLO = gql`
  query UnipileHello {
    hello @rest(type: "Hello", path: "/integrations/unipile/hello") {
      message
    }
  }
`;

const POLL_MS = 5000;
const StyledContainer = styled.div`
  display: flex;
  align-items: center;
  flex-direction: column;
  height: 100dvh;
  justify-content: center;
  width: 100%;
  padding: ${({ theme }) => theme.spacing(6)};
`;

const StyledCardWrapper = styled.div`
  display: flex;
  background-color: ${({ theme }) => theme.background.primary};
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 640px;
  padding: ${({ theme }) => theme.spacing(6)};
  box-shadow: ${({ theme }) => theme.boxShadow.strong};
  border-radius: ${({ theme }) => theme.border.radius.md};
`;

const StyledTitle = styled.h2`
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.lg};
  margin: 0 0 ${({ theme }) => theme.spacing(4)} 0;
`;

const StyledMessage = styled.div`
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.md};
  margin-top: ${({ theme }) => theme.spacing(2)};
`;

const StyledError = styled.div`
  color: ${({ theme }) => ((theme as any).color?.danger ?? 'red')};
  margin-top: ${({ theme }) => theme.spacing(2)};
`;

export const UnipileContactsReview = () => {
  const client = useApolloClient();
  const currentWorkspaceMember = useRecoilValue(currentWorkspaceMemberState);

  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<any>(null);
  const [message, setMessage] = useState<string | null>(null);

  const pollRef = useRef<number | null>(null);

  const fetchHello = async () => {
    setLoading(true);
    setError(null);

    try {
      const res: any = await client.query({ query: UNIPILE_HELLO, fetchPolicy: 'no-cache' });
      setMessage(res?.data?.hello?.message ?? JSON.stringify(res?.data));
      setLastUpdated(Date.now());
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Only run when user is authenticated / workspace member exists
    if (!currentWorkspaceMember) return;

    fetchHello();

    // Start polling only while component mounted and user present
    pollRef.current = window.setInterval(() => {
      fetchHello();
    }, POLL_MS);

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
      }
    };
  }, [client, currentWorkspaceMember]);

  const onManualRefresh = async () => {
    await fetchHello();
  };

  return (
    <StyledContainer>
      <StyledCardWrapper>
        <StyledTitle>Unipile — Contacts Review</StyledTitle>
        {loading && <StyledMessage>Loading...</StyledMessage>}
        {message && <StyledMessage>{message}</StyledMessage>}
        {error && (
          <StyledError>
            Error: {error.message ?? String(error)}
            {error?.networkError && (
              <div>
                <pre style={{ whiteSpace: 'pre-wrap', marginTop: 8 }}>
                  {JSON.stringify(
                    {
                      status: error.networkError.statusCode ?? error.networkError.status,
                      body: error.networkError.result ?? error.networkError.response ?? null,
                    },
                    null,
                    2,
                  )}
                </pre>
              </div>
            )}
          </StyledError>
        )}
        <div style={{ marginTop: 16 }}>
          <button onClick={onManualRefresh}>Refresh</button>
          {lastUpdated && (
            <StyledMessage style={{ display: 'inline-block', marginLeft: 12 }}>
              Last updated: {new Date(lastUpdated).toLocaleTimeString()}
            </StyledMessage>
          )}
        </div>
      </StyledCardWrapper>
    </StyledContainer>
  );
};

export default UnipileContactsReview;
