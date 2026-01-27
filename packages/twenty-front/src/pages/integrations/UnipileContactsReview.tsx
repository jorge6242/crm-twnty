import { gql, useApolloClient } from '@apollo/client';
import styled from '@emotion/styled';
import { useEffect, useState } from 'react';

const UNIPILE_HELLO = gql`
  query UnipileHello {
    hello @rest(type: "Hello", path: "/integrations/unipile/hello") {
      message
    }
  }
`;

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
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    client
      .query({ query: UNIPILE_HELLO, fetchPolicy: 'no-cache' })
      .then((res: any) => {
        if (!mounted) return;
        setMessage(res?.data?.hello?.message ?? JSON.stringify(res?.data));
      })
      .catch((e: any) => {
        if (!mounted) return;
        setError(e?.message ?? String(e));
      });

    return () => {
      mounted = false;
    };
  }, [client]);

  return (
    <StyledContainer>
      <StyledCardWrapper>
        <StyledTitle>Unipile — Contacts Review</StyledTitle>
        {message && <StyledMessage>{message}</StyledMessage>}
        {error && <StyledError>Error: {error}</StyledError>}
        {!message && !error && <StyledMessage>Loading...</StyledMessage>}
      </StyledCardWrapper>
    </StyledContainer>
  );
};

export default UnipileContactsReview;
