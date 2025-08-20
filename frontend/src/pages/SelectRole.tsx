// frontend/src/pages/SelectRole.tsx
import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Box, Paper, Typography, Button, Stack, Avatar } from '@mui/material';

const roleNames: { [key: string]: string } = {
  'solicitante': 'Solicitante de Diárias',
  'controle-interno': 'Controle Interno',
  'admin-geral': 'Administrador Geral',
  'assinatura': 'Responsável por Assinatura',
  'contabilidade': 'Contabilidade',
  'pagamento': 'Tesouraria/Pagamento'
};

const getInitials = (name: string) =>
  name
    .split(' ')
    .map((s) => s[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

export const SelectRole: React.FC = () => {
  const { user, selectRole } = useAuth();

  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        backgroundColor: '#f0f2f5',
        px: 2,
      }}
    >
      <Paper
        elevation={8}
        sx={{
          width: '100%',
          maxWidth: 560,
          p: { xs: 3, sm: 4 },
          borderRadius: 3,
          textAlign: 'center',
          position: 'relative',
          overflow: 'visible'
        }}
      >
        <Typography variant="h5" component="h1" fontWeight="bold" mb={1}>
          Selecione um Perfil
        </Typography>

        <Typography variant="body1" color="text.secondary" mb={4}>
          Olá, {user?.first_name}! Vimos que você possui mais de um perfil de acesso. Por favor,
          escolha como deseja continuar.
        </Typography>

        <Stack spacing={2}>
          {user?.roles.map((roleSlug) => {
            const friendly = roleNames[roleSlug] || roleSlug;
            const initials = getInitials(friendly);

            return (
              <Button
                key={roleSlug}
                fullWidth
                onClick={() => selectRole(roleSlug)}
                disableElevation
                // Usando função no sx para ter acesso ao theme (cores do tema)
                sx={(theme) => ({
                  backgroundColor: theme.palette.grey[100],
                  color: theme.palette.text.primary,
                  justifyContent: 'center',
                  py: 1.5,
                  borderRadius: 2,
                  textTransform: 'none',
                  boxShadow: 'none',
                  alignItems: 'center',
                  transition: 'background-color 180ms, transform 120ms',
                  // efeito sutil ao passar o mouse
                  '&:hover': {
                    backgroundColor: theme.palette.grey[200],
                    transform: 'translateY(-2px)',
                    boxShadow: 'none',
                  },
                  // foco acessível
                  '&:focus-visible': {
                    outline: `3px solid ${theme.palette.primary.light}`,
                    outlineOffset: '2px',
                  },
                })}
              >
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                    width: '100%',
                    justifyContent: 'center',
                  }}
                >
                  <Avatar
                    sx={(theme) => ({
                      bgcolor: 'transparent',
                      color: theme.palette.primary.main,
                      width: 36,
                      height: 36,
                      fontWeight: 700,
                      border: `1px solid ${theme.palette.primary.light}`,
                    })}
                    aria-hidden
                  >
                    {initials}
                  </Avatar>

                  <Box
                    component="span"
                    sx={{
                      display: 'inline-flex',
                      alignItems: 'baseline',
                      gap: 1,
                      fontSize: 16,
                      lineHeight: 1,
                    }}
                  >
                    <Box component="span" sx={{ color: 'text.primary' }}>
                      Entrar como
                    </Box>

                    <Box
                      component="span"
                      sx={{
                        color: 'primary.main',
                        fontWeight: 700,
                        ml: 0.5,
                      }}
                    >
                      {friendly}
                    </Box>
                  </Box>
                </Box>
              </Button>
            );
          })}
        </Stack>
      </Paper>
    </Box>
  );
};
