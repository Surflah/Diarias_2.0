// frontend/src/pages/NovaDiaria.tsx
import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Checkbox,
  FormControlLabel,
  Grid,
} from '@mui/material';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import dayjs, { Dayjs } from 'dayjs';

const initialState = {
  objetivo_viagem: '',
  destino: '',
  data_saida: null as Dayjs | null,
  data_retorno: null as Dayjs | null,
  meio_transporte: '',
  placa_veiculo: '',
  envolve_passagens_aereas: false,
  solicita_pagamento_inscricao: false,
  valor_taxa_inscricao: 0,
};

export const NovaDiaria = () => {
  const [formData, setFormData] = useState(initialState);

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = event.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleDateChange = (name: string, newValue: Dayjs | null) => {
    setFormData((prev) => ({
      ...prev,
      [name]: newValue,
    }));
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <Paper sx={{ p: 3, maxWidth: 900, margin: 'auto' }}>
        <Typography variant="h5" component="h1" gutterBottom>
          Solicitação de Nova Diária
        </Typography>

        <Box component="form" noValidate autoComplete="off">
          <Grid container spacing={3}>
            <Grid size={12}>
              <TextField
                name="objetivo_viagem"
                label="Objetivo da Viagem"
                value={formData.objetivo_viagem}
                onChange={handleInputChange}
                multiline
                rows={4}
                fullWidth
                required
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                name="destino"
                label="Cidade de Destino"
                value={formData.destino}
                onChange={handleInputChange}
                fullWidth
                required
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControl fullWidth required>
                <InputLabel id="meio-transporte-label">Meio de Transporte</InputLabel>
                <Select
                  labelId="meio-transporte-label"
                  name="meio_transporte"
                  value={formData.meio_transporte}
                  label="Meio de Transporte"
                  // onChange do Select tem tipo próprio; aqui mantemos cast simples
                  onChange={handleInputChange as any}
                >
                  <MenuItem value="VEICULO_PROPRIO">Veículo Próprio</MenuItem>
                  <MenuItem value="VEICULO_OFICIAL">Veículo Oficial</MenuItem>
                  <MenuItem value="AEREO">Transporte Aéreo</MenuItem>
                  <MenuItem value="ONIBUS">Transporte Rodoviário (Ônibus)</MenuItem>
                  <MenuItem value="OUTRO">Outro</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              <DateTimePicker
                label="Data e Hora da Saída"
                value={formData.data_saida}
                onChange={(newValue) => handleDateChange('data_saida', newValue)}
                slotProps={{ textField: { fullWidth: true } }}
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              <DateTimePicker
                label="Data e Hora do Retorno"
                value={formData.data_retorno}
                onChange={(newValue) => handleDateChange('data_retorno', newValue)}
                slotProps={{ textField: { fullWidth: true } }}
              />
            </Grid>

            {/* Campos Condicionais */}
            {formData.meio_transporte === 'VEICULO_PROPRIO' && (
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  name="placa_veiculo"
                  label="Placa do Veículo"
                  value={formData.placa_veiculo}
                  onChange={handleInputChange}
                  fullWidth
                />
              </Grid>
            )}

            <Grid size={12}>
              <FormControlLabel
                control={
                  <Checkbox
                    name="envolve_passagens_aereas"
                    checked={formData.envolve_passagens_aereas}
                    onChange={handleInputChange}
                  />
                }
                label="A viagem envolve a compra de passagens aéreas?"
              />
            </Grid>

            {/* Box para os valores calculados */}
            <Grid size={12}>
              <Paper variant="outlined" sx={{ p: 2, backgroundColor: '#f5f5f5' }}>
                <Typography variant="h6">Valores Calculados (Preview)</Typography>
                <Typography>Valor das Diárias: R$ 0,00</Typography>
                <Typography>Valor do Deslocamento: R$ 0,00</Typography>
                <Typography>Distância (ida e volta): 0 km</Typography>
                <Typography variant="body1" fontWeight="bold" sx={{ mt: 1 }}>
                  Total a Empenhar: R$ 0,00
                </Typography>
              </Paper>
            </Grid>

            <Grid size={12} sx={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button variant="contained" color="primary" size="large">
                Enviar Solicitação
              </Button>
            </Grid>
          </Grid>
        </Box>
      </Paper>
    </LocalizationProvider>
  );
};
