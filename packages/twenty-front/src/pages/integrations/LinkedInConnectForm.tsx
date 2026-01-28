import styled from '@emotion/styled';
import { FC, useState } from 'react';

const FormWrapper = styled.form`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(3)};
  width: 100%;
  max-width: 400px;
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

const Button = styled.button`
  padding: ${({ theme }) => theme.spacing(2)};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  border: none;
  background-color: ${({ theme }) => theme.color.green1};
  color: ${({ theme }) => theme.color.gray};
  font-size: ${({ theme }) => theme.font.size.md};
  cursor: pointer;

  &:hover {
    background-color: ${({ theme }) => theme.color.green2};
  }
`;

interface LinkedInConnectFormProps {
  onConnectSocialAccount: (credentials: { username: string; password: string }) => void;
}

const LinkedInConnectForm: FC<LinkedInConnectFormProps> = ({ onConnectSocialAccount }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  // Solo control de inputs, sin lógica de submit aún

 const onSubmit = (e: React.FormEvent) => {
    onConnectSocialAccount({ username, password });
  }

  return (
    <FormWrapper onSubmit={onSubmit}>
      <Label htmlFor="linkedin-username">Usuario de LinkedIn</Label>
      <Input
        id="linkedin-username"
        type="text"
        autoComplete="username"
        value={username}
        onChange={e => setUsername(e.target.value)}
        placeholder="Correo o usuario"
      />
      <Label htmlFor="linkedin-password">Contraseña de LinkedIn</Label>
      <Input
        id="linkedin-password"
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={e => setPassword(e.target.value)}
        placeholder="Contraseña"
      />

      <Button type="button" onClick={onSubmit}>Conectar cuenta de LinkedIn</Button>
    </FormWrapper>
  );
};

export default LinkedInConnectForm;
