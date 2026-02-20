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
  justify-content: center;
  width: 100%;
`;

const StyledButton = styled(Button)`
  width: 100% !important;
  min-width: 280px !important;

  /* Forzar flex en el contenedor interno */
  & > div,
  & > span {
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    gap: ${({ theme }) => theme.spacing(2)} !important;
    width: 100% !important;
    overflow: visible !important;
  }

  /* Evitar truncado del texto */
  white-space: nowrap !important;
  text-overflow: clip !important;
`;

const StyledText = styled.div`
  display: flex;
  justify-content: center;
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.lg};
`;

const StyledCustomButton = styled.button<{ $isLoading?: boolean }>`
  /* Layout base similar al Button de Twenty */
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: ${({ theme }) => theme.spacing(2)};

  /* Tamaño controlado por vos */
  width: 100%;
  min-width: 220px;
  height: 40px;
  padding: 0 ${({ theme }) => theme.spacing(5)};

  /* Colores de Twenty CRM */
  background-color: ${({ theme, $isLoading }) => $isLoading ? theme.background.tertiary  : theme.background.primary};

  color: ${({ $isLoading }) => $isLoading ? 'grey'  : 'white'};
  border: 2px solid grey;
  border-radius: ${({ theme }) => theme.border.radius.sm};

  /* Typography */
  font-family: ${({ theme }) => theme.font.family};
  font-size: ${({ theme }) => theme.font.size.md};
  font-weight: ${({ theme }) => theme.font.weight.medium};

  /* Estados */
  cursor: ${({ $isLoading }) => $isLoading ? 'wait' : 'pointer'};
  pointer-events: ${({ $isLoading }) => $isLoading ? 'none' : 'auto'};

  /* Animaciones */
  transition: background-color 0.15s ease;
`;

const LoadingSpinner = styled.div`
  width: 14px;
  height: 14px;
  border: 2px solid currentColor;
  border-right-color: transparent;
  border-radius: 50%;
  animation: rotate 0.75s linear infinite;

  @keyframes rotate {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
`;

const ButtonText = styled.span`
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
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
        <CustomLoadingButton
          type="submit"
          isLoading={socialLoading}
        >
          {socialLoading ? "Connecting..." : "Connect to LinkedIn"}
        </CustomLoadingButton>
      </ButtonContainer>
    </FormWrapper>
  );
};

export default LinkedInConnectForm;

interface CustomButtonProps {
  isLoading?: boolean;
  children: React.ReactNode;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  type?: 'button' | 'submit' | 'reset';
  disabled?: boolean;
}

const CustomLoadingButton: FC<CustomButtonProps> = ({
  isLoading,
  children,
  onClick,
  type = 'button',
  disabled,
}) => {
  return (
    <StyledCustomButton
      type={type}
      onClick={onClick}
      disabled={disabled || isLoading}
      $isLoading={isLoading}
    >
      {isLoading && <LoadingSpinner />}
      <ButtonText>{children}</ButtonText>
    </StyledCustomButton>
  );
};
