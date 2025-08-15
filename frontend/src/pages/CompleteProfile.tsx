
// frontend/src/pages/CompleteProfile.tsx

import React, { useState, forwardRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Paper, Typography, TextField, Button, CircularProgress, Alert } from '@mui/material';
import { IMaskInput } from 'react-imask';
import apiClient from '../api/axiosConfig';

// --- Componente Customizado para a Máscara do CPF ---
interface CustomProps {
  onChange: (event: { target: { name: string; value: string } }) => void;
  name: string;
}

const CpfMask = forwardRef<HTMLInputElement, CustomProps>(
  function CpfMask(props, ref) {
    const { onChange, ...other } = props;
    return (
      <IMaskInput
        {...other}
        mask="000.000.000-00"
        inputRef={ref}
        onAccept={(value: any) => onChange({ target: { name: props.name, value } })}
        overwrite
      />
    );
  },
);
// --- Fim do Componente de Máscara ---


export const CompleteProfile = () => {
  const [cpf, setCpf] = useState('');
  const [cargo, setCargo] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsLoading(true);
    setError('');

    if (!cpf || !cargo) {
      setError('Por favor, preencha todos os campos.');
      setIsLoading(false);
      return;
    }

    try {
      await apiClient.patch('/profile/me/', { cpf, cargo });
      navigate('/dashboard'); // Sucesso! Redireciona para o dashboard.
    } catch (err) {
      console.error('Erro ao atualizar o perfil:', err);
      setError('Não foi possível salvar o perfil. Tente novamente.');
      setIsLoading(false);
    }
  };

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
        }}
        component="form"
        onSubmit={handleSubmit}
      >
        <Typography variant="h5" component="h1" fontWeight="bold" textAlign="center" mb={2}>
          Complete seu Cadastro
        </Typography>
        <Typography variant="body1" textAlign="center" mb={4}>
          Precisamos de algumas informações adicionais para continuar.
        </Typography>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        <TextField
          label="CPF"
          value={cpf}
          onChange={(e) => setCpf(e.target.value)}
          name="cpf"
          fullWidth
          required
          sx={{ mb: 3 }}
          InputProps={{
            inputComponent: CpfMask as any,
          }}
          variant="outlined"
        />

        <TextField
          label="Cargo"
          value={cargo}
          onChange={(e) => setCargo(e.target.value)}
          name="cargo"
          fullWidth
          required
          sx={{ mb: 4 }}
          placeholder="Ex: Vereador, Assessor Parlamentar, etc."
          variant="outlined"
        />

        <Button
          type="submit"
          variant="contained"
          size="large"
          fullWidth
          disabled={isLoading}
          startIcon={isLoading ? <CircularProgress size={20} color="inherit" /> : null}
        >
          {isLoading ? 'Salvando...' : 'Salvar e Continuar'}
        </Button>
      </Paper>
    </Box>
  );
};