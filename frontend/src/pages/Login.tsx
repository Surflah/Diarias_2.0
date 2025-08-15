// frontend/src/pages/Login.tsx

import React from 'react';
import { useGoogleLogin, GoogleOAuthProvider } from '@react-oauth/google';
import { Button, Box, Typography, Paper } from '@mui/material';
import { useAuth } from '../context/AuthContext';

import backgroundImage from '../assets/background.png';

const GOOGLE_CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID || "";

const GoogleIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M22.56 12.25C22.56 11.45 22.49 10.68 22.36 9.92H12V14.45H18.06C17.72 16.03 16.84 17.39 15.52 18.28V21.1H19.48C21.46 19.29 22.56 16.03 22.56 12.25Z" fill="#4285F4"/>
      <path d="M12 23C15.24 23 17.95 21.92 19.48 20.1L15.52 17.28C14.45 18 13.28 18.41 12 18.41C9.21 18.41 6.83 16.63 5.92 14.24H1.88V17.14C3.76 20.69 7.5 23 12 23Z" fill="#34A853"/>
      <path d="M5.92 14.24C5.69 13.54 5.56 12.78 5.56 12C5.56 11.22 5.69 10.46 5.92 9.76V6.86H1.88C0.68 9.32 0 12 0 12C0 12 0.68 14.68 1.88 17.14L5.92 14.24Z" fill="#FBBC05"/>
      <path d="M12 5.59C13.44 5.59 14.71 6.1 15.71 7.02L19.57 3.16C17.95 1.63 15.24 0 12 0C7.5 0 3.76 2.31 1.88 5.86L5.92 8.76C6.83 6.37 9.21 4.59 12 4.59Z" fill="#EA4335"/>
    </svg>
);

export const Login = () => {
  const { loginWithGoogle, isLoading } = useAuth();

  const handleGoogleLogin = useGoogleLogin({
    flow: 'auth-code',
    onSuccess: (codeResponse) => {
      loginWithGoogle(codeResponse.code);
    },
    onError: (error) => console.log('Login Failed:', error),
  });

  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      {/* <-- MODIFICADO: A direção do flexbox agora é 'column' para empilhar os itens */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column', // Empilha os itens verticalmente
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          width: '100vw',
          backgroundColor: '#f0f2f5',
        }}
      >
        {/* <-- MUDANÇA PRINCIPAL: A imagem agora é um elemento separado, FORA do Paper */}
        <Box
          component="img"
          src={backgroundImage}
          alt="Brasão da Câmara de Itapoá"
          sx={{
            width: 'auto', // Largura automática para manter proporção
            height: 'auto',
            maxHeight: '150px', // Altura máxima para controlar o tamanho
            mb: 4, // Margem inferior (o "espacinho") para separar do card
          }}
        />

        {/* O Paper agora contém apenas o formulário, sem a imagem no topo */}
        <Paper
          elevation={8}
          sx={{
            width: '100%',
            maxWidth: '450px',
            borderRadius: 3,
            m: 2,
            p: 4, // O padding agora pode ser aplicado diretamente no Paper
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 2,
          }}
        >
          <Typography variant="h5" component="h1" fontWeight="bold" textAlign="center">
            Sistema de Diárias
          </Typography>

          <Typography variant="body1" textAlign="center">
            Acesse com sua conta institucional: {' '}
            <Typography component="span" fontWeight="bold" sx={{ color: 'primary.main' }}>
              @camaraitapoa.sc.gov.br
            </Typography>
          </Typography>

          <Button
            variant="contained"
            onClick={() => handleGoogleLogin()}
            startIcon={<GoogleIcon />}
            disabled={isLoading}
            size="large"
            fullWidth
            sx={{ textTransform: 'none', fontWeight: 'bold', mt: 2 }}
          >
            {isLoading ? 'Aguarde...' : 'Entrar com Google'}
          </Button>
        </Paper>
      </Box>
    </GoogleOAuthProvider>
  );
};