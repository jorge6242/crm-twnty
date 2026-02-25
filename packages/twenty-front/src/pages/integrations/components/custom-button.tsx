
import styled from '@emotion/styled';
import { FC } from 'react';

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
  color: ${({ theme }) => theme.font.color.primary};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

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

export default CustomLoadingButton;
