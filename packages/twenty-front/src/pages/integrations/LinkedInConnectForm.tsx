import styled from '@emotion/styled';
import { FC, useState } from 'react';
import { Button } from 'twenty-ui/input';

const FormWrapper = styled.form`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(3)};
  width: 100%;
  max-width: 400px;
  border: 2px solid grey;
  padding: ${({ theme }) => theme.spacing(4)};
  border-radius: ${({ theme }) => theme.border.radius.md};
`;

const Label = styled.label`
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.md};
`;

const Input = styled.input`
  padding: ${({ theme }) => theme.spacing(2)};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  border: 1px solid ${({ theme }) => theme.border.color};
  font-size: ${({ theme }) => theme.font.size.md};
`;

const InputContainer = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing(2)};
  align-items: center;
`;

const ButtonContainer = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing(2)};
  justify-content: center
`;

const StyledText = styled.div`
  display: flex;
  justify-content: center;
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.lg};
`;

interface LinkedInConnectFormProps {
  onConnectSocialAccount: (credentials: {
    username: string;
    password: string;
  }) => void;
  socialLoading: boolean;
}

const LinkedInConnectForm: FC<LinkedInConnectFormProps> = ({
  onConnectSocialAccount,
  socialLoading,
}) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

    const handleKeyDown = (e: React.KeyboardEvent) => {
    e.stopPropagation();
  };

    const handleKeyUp = (e: React.KeyboardEvent) => {
    e.stopPropagation();
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    e.stopPropagation();
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConnectSocialAccount({ username, password });
  };

  return (
    <FormWrapper onSubmit={onSubmit}>
      <StyledText>Connect your LinkedIn account</StyledText>
      <InputContainer>
        <Label htmlFor="linkedin-username">Username</Label>
        <Input
          id="linkedin-username"
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Email or username"
          onKeyDown={handleKeyDown}
          onKeyUp={handleKeyUp}
          onKeyPress={handleKeyPress}
          required
        />
      </InputContainer>
      <InputContainer>
        <Label htmlFor="linkedin-password">Password</Label>
        <Input
          id="linkedin-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          onKeyDown={handleKeyDown}
          onKeyUp={handleKeyUp}
          onKeyPress={handleKeyPress}
          required
        />
      </InputContainer>

      <ButtonContainer>

      <Button
        isLoading={socialLoading}
        title="Connect"

        onClick={onSubmit}
      />

      </ButtonContainer>
    </FormWrapper>
  );
};

export default LinkedInConnectForm;
