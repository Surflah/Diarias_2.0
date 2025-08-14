// frontend/src/pages/SelectRole.tsx

import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Box, Paper, Typography, Button, Stack } from '@mui/material';

// Um mapa para nomes mais amigáveis (opcional, mas melhora a UX)
const roleNames: { [key: string]: string } = {
  'solicitante': 'Solicitante de Diárias',
  'controle-interno': 'Controle Interno',
  'admin-geral': 'Administrador Geral',
  'assinatura': 'Responsável por Assinatura',
  'contabilidade': 'Contabilidade',
  'pagamento': 'Tesouraria/Pagamento'
};

export const SelectRole = () => {
  const { user, selectRole } = useAuth();

  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        backgroundColor: '#f0f2f5',
      }}
    >
      <Paper
        elevation={8}
        sx={{
          width: '100%',
          maxWidth: '500px',
          p: 4,
          m: 2,
          borderRadius: 3,
          textAlign: 'center',
        }}
      >
        <Typography variant="h5" component="h1" fontWeight="bold" mb={1}>
          Selecione um Perfil
        </Typography>
        <Typography variant="body1" color="text.secondary" mb={4}>
          Olá, {user?.first_name}! Vimos que você possui mais de um perfil de acesso. Por favor, escolha como deseja continuar.
        </Typography>

        <Stack spacing={2}>
          {user?.roles.map((roleSlug) => (
            <Button
              key={roleSlug}
              variant="contained"
              size="large"
              onClick={() => selectRole(roleSlug)}
            >
              Entrar como {roleNames[roleSlug] || roleSlug}
            </Button>
          ))}
        </Stack>
      </Paper>
    </Box>
  );
};