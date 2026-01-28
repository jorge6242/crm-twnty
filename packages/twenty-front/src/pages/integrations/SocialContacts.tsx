import { gql, useApolloClient } from '@apollo/client';
import styled from '@emotion/styled';
import { useEffect, useState } from 'react';
import LinkedInConnectForm from './LinkedInConnectForm';

const SOCIAL_HELLO = gql`
  query SocialHello {
    hello @rest(type: "Hello", path: "/integrations/social-contacts/hello") {
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

export const SocialContacts = () => {
  const client = useApolloClient();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onConnectSocialAccount = ({ username, password }) => {
    // Lógica para iniciar el flujo de conexión de la cuenta social
  }

  useEffect(() => {
    let mounted = true;

    client
      .query({ query: SOCIAL_HELLO, fetchPolicy: 'no-cache' })
      .then((res: any) => {
        if (!mounted) return;
        setMessage(res?.data?.hello?.message ?? JSON.stringify(res?.data));
      })
      .catch((e: any) => {
        if (!mounted) return;
        setError(e?.message ?? String(e));
        // eslint-disable-next-line no-console
        console.error('SocialContacts fetch error', e);
      });

    return () => {
      mounted = false;
    };
  }, [client]);

  return (
    <StyledContainer>
      <StyledCardWrapper>
        <StyledTitle>Social Contacts</StyledTitle>
        {/* Formulario de conexión LinkedIn */}
        <LinkedInConnectForm onConnectSocialAccount={onConnectSocialAccount} />


      </StyledCardWrapper>
    </StyledContainer>
  );
};

export default SocialContacts;
