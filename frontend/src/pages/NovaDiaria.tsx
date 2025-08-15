// frontend/src/components/NovaDiaria.tsx
import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { PlacesAutocomplete } from '../components/PlacesAutocomplete';
import {
  Box, Paper, Typography, TextField, Button, FormControl, InputLabel,
  Select, MenuItem, Checkbox, FormControlLabel, Grid, Alert,
  TableContainer, Table, TableHead, TableRow, TableCell, TableBody, Divider,
  RadioGroup, FormLabel, Radio, Link,
} from '@mui/material';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { Dayjs } from 'dayjs';
import apiClient from '../api/axiosConfig';

// --- Interfaces (mantive as suas) ---
interface CalculoData {
  calculo_diarias: {
    num_com_pernoite: number; upm_com_pernoite: number; total_com_pernoite: number;
    num_sem_pernoite: number; upm_sem_pernoite: number; total_sem_pernoite: number;
    num_meia_diaria: number; upm_meia_diaria: number; total_meia_diaria: number;
    valor_upm_usado: number; valor_total_diarias: number;
  };
  calculo_deslocamento: {
    valor_deslocamento: number; distancia_km: number; preco_gas_usado: number;
  };
  total_empenhar: number;
}

type Region = 'LOCAL' | 'OUTROS';
type TipoDiaria = 'COM_PERNOITE' | 'SEM_PERNOITE' | 'MEIA_DIARIA';

interface FormFields {
  destino: string;
  data_saida: Dayjs | null;
  data_retorno: Dayjs | null;
  meio_transporte: string;
  placa_veiculo: string;
  solicita_viagem_antecipada: boolean;
  finalidade_viagem: string;
  solicita_pagamento_inscricao: boolean;
  valor_taxa_inscricao: number;
  observacoes: string;
  regiao_diaria: Region;
  tipo_diaria: TipoDiaria;
  num_com_pernoite: number;
  num_sem_pernoite: number;
  num_meia_diaria: number;
  valor_upm: number;
}

const initialFormData: FormFields = {
  destino: '',
  data_saida: null,
  data_retorno: null,
  meio_transporte: '',
  placa_veiculo: '',
  solicita_viagem_antecipada: false,
  finalidade_viagem: '',
  solicita_pagamento_inscricao: false,
  valor_taxa_inscricao: 0,
  observacoes: '',
  regiao_diaria: 'LOCAL',
  tipo_diaria: 'COM_PERNOITE',
  num_com_pernoite: 0,
  num_sem_pernoite: 0,
  num_meia_diaria: 0,
  valor_upm: 1,
};

const initialCalculoData: CalculoData = {
  calculo_diarias: {
    num_com_pernoite: 0, upm_com_pernoite: 0, total_com_pernoite: 0,
    num_sem_pernoite: 0, upm_sem_pernoite: 0, total_sem_pernoite: 0,
    num_meia_diaria: 0, upm_meia_diaria: 0, total_meia_diaria: 0,
    valor_upm_usado: 0, valor_total_diarias: 0,
  },
  calculo_deslocamento: { valor_deslocamento: 0, distancia_km: 0, preco_gas_usado: 0 },
  total_empenhar: 0,
};

const UPM_TABLE: Record<Region, Record<TipoDiaria, number>> = {
  LOCAL: { COM_PERNOITE: 100, SEM_PERNOITE: 40, MEIA_DIARIA: 20 },
  OUTROS: { COM_PERNOITE: 200, SEM_PERNOITE: 80, MEIA_DIARIA: 0 },
};

const formatCurrency = (value: number) => {
  return value > 0 ? value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—, --';
};

export const NovaDiaria = () => {
  const { user } = useAuth();
  const [formData, setFormData] = useState<FormFields>(initialFormData);
  const [calculoData, setCalculoData] = useState<CalculoData>(initialCalculoData);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [isCalculating, setIsCalculating] = useState(false);
  const [calculoError, setCalculoError] = useState('');

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement> | any) => {
    const { name, value, type, checked } = event.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : (type === 'number' ? (Number(value) || 0) : value),
    }));
  };

  const handleDateChange = (name: string, newValue: Dayjs | null) => {
    setFormData(prev => ({ ...prev, [name]: newValue }));
  };

  const numeroDeDiarias = formData.data_saida && formData.data_retorno
    ? formData.data_retorno.diff(formData.data_saida, 'day') + 1
    : 0;

  // Trigger cálculo via API (aceita destino opcional)
  const triggerCalculation = useCallback(async (optionalDestino?: string) => {
    if (!formData.data_saida || !formData.data_retorno) return;
    // garantindo que retorno >= saida
    if (!formData.data_retorno.isAfter(formData.data_saida) && !formData.data_retorno.isSame(formData.data_saida)) return;

    const destinoToSend = optionalDestino ?? formData.destino;
    if (!destinoToSend) return; // sem destino não manda

    setIsCalculating(true);
    setCalculoError('');
    try {
      const payload = {
        destino: destinoToSend,
        data_saida: formData.data_saida.toISOString(),
        data_retorno: formData.data_retorno.toISOString(),
      };
      const response = await apiClient.post<CalculoData>('/processos/calcular-preview/', payload);
      setCalculoData(response.data);
    } catch (error: any) {
      console.error('calcular-preview status:', error?.response?.status);
      console.error('calcular-preview response.data:', error?.response?.data);
      setCalculoError(
          error?.response?.data?.error ||
          (error?.response?.data ? JSON.stringify(error.response.data) : 'Erro ao calcular valores.')
     );
     setCalculoData(initialCalculoData);
    } finally {
     setIsCalculating(false);
    }
  }, [formData.destino, formData.data_saida, formData.data_retorno]);

  // when user selects a place from autocomplete
  const handlePlaceSelect = (address: string) => {
    setFormData(prev => ({ ...prev, destino: address }));
    // pede cálculo ao backend já com o destino selecionado
    triggerCalculation(address);
  };

  // Função que aplica a lógica de distribuição das diárias conforme regras que você descreveu
  const applyDiariasDistribution = useCallback(() => {
    const N = numeroDeDiarias;
    let num_com = 0, num_sem = 0, num_meia = 0;
    const tipo = formData.tipo_diaria;
    const antecipada = formData.solicita_viagem_antecipada;

    if (N <= 0) {
      // zerar
      num_com = num_sem = num_meia = 0;
    } else if (N === 1) {
      // Deve perguntar ao usuário: meia diária ou sem pernoite
      // Aqui mantemos por padrão: se tipo_diaria já for MEIA_DIARIA => meia; if SEM_PERNOITE => sem
      // Se tipo estiver COM_PERNOITE e N===1 mostramos opção ao usuário (via RadioGroup abaixo)
      if (tipo === 'SEM_PERNOITE') {
        num_sem = 1;
      } else if (tipo === 'MEIA_DIARIA') {
        num_meia = 1;
      } else {
        // COM_PERNOITE + 1 dia -> precisamos que o usuário escolha; por enquanto mantemos sem pernoite (vai mostrar escolha UI)
        // não sobrescrever aqui; UI radios irão definir um campo auxiliar 'tipo_unico_dia_choice'
      }
    } else { // N >= 2
      if (tipo === 'SEM_PERNOITE') {
        num_sem = N;
      } else if (tipo === 'MEIA_DIARIA') {
        num_meia = N;
      } else if (tipo === 'COM_PERNOITE') {
        if (antecipada) {
          // 1 meia + (N-1) com pernoite
          num_meia = 1;
          num_com = N - 1;
        } else {
          // (N-1) com pernoite + 1 sem pernoite
          num_com = N - 1;
          num_sem = 1;
        }
      }
    }

    // se usuário tiver escolhido explicitamente radios para o caso 1-dia, respeitar:
    // (guardado em formData.num_* se já ajustado por UI)
    setFormData(prev => ({
      ...prev,
      num_com_pernoite: num_com,
      num_sem_pernoite: num_sem,
      num_meia_diaria: num_meia,
    }));
  }, [numeroDeDiarias, formData.tipo_diaria, formData.solicita_viagem_antecipada]);

  // quando datas / tipo / antecipada mudam, recalcula distribuição
  useEffect(() => {
    applyDiariasDistribution();
  }, [applyDiariasDistribution]);

  useEffect(() => {
    if (numeroDeDiarias === 1 && formData.tipo_diaria === 'COM_PERNOITE') {
      // Define 'Sem Pernoite' como o novo padrão para evitar um estado inválido
      setFormData(prev => ({ ...prev, tipo_diaria: 'SEM_PERNOITE' }));
    }
  }, [numeroDeDiarias, formData.tipo_diaria]);

  // cálculos monetários + deslocamento (usando UPM_TABLE + distancia vindo de calculoData)
  useEffect(() => {
    const valorUpm = Number(formData.valor_upm) || 0;
    const num_com = Number(formData.num_com_pernoite) || 0;
    const num_sem = Number(formData.num_sem_pernoite) || 0;
    const num_meia = Number(formData.num_meia_diaria) || 0;
    const region = formData.regiao_diaria;

    const upmCom = UPM_TABLE[region].COM_PERNOITE;
    const upmSem = UPM_TABLE[region].SEM_PERNOITE;
    const upmMeia = UPM_TABLE[region].MEIA_DIARIA;

    const totalUpm = (num_com * upmCom) + (num_sem * upmSem) + (num_meia * upmMeia);
    const valor_total_diarias = totalUpm * valorUpm;

    const distancia_km = calculoData.calculo_deslocamento.distancia_km || 0;
    const preco_gas = Number(calculoData.calculo_deslocamento.preco_gas_usado) || 0;
    const valor_deslocamento = (distancia_km / 10) * preco_gas;

    const total_empenhar = valor_total_diarias + valor_deslocamento + (formData.solicita_pagamento_inscricao ? Number(formData.valor_taxa_inscricao || 0) : 0);

    setCalculoData(prev => ({
      ...prev,
      calculo_diarias: {
        num_com_pernoite: num_com,
        upm_com_pernoite: upmCom,
        total_com_pernoite: num_com * upmCom * valorUpm,
        num_sem_pernoite: num_sem,
        upm_sem_pernoite: upmSem,
        total_sem_pernoite: num_sem * upmSem * valorUpm,
        num_meia_diaria: num_meia,
        upm_meia_diaria: upmMeia,
        total_meia_diaria: num_meia * upmMeia * valorUpm,
        valor_upm_usado: valorUpm,
        valor_total_diarias,
      },
      calculo_deslocamento: {
        ...prev.calculo_deslocamento,
        valor_deslocamento,
      },
      total_empenhar,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.num_com_pernoite, formData.num_sem_pernoite, formData.num_meia_diaria, formData.regiao_diaria, formData.valor_upm, formData.solicita_pagamento_inscricao, formData.valor_taxa_inscricao, calculoData.calculo_deslocamento.distancia_km]);

  // preview image / files (mantive seu código)
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    setAttachedFiles(prev => [...prev, f]);
    const reader = new FileReader();
    reader.onload = () => setImagePreview(String(reader.result));
    reader.readAsDataURL(f);
  };

  const uploadFilesToDrive = async () => {
    if (attachedFiles.length === 0) return;
    alert('O upload para o Google Drive precisa de um endpoint backend. Configure service account.');
  };

  // Aux: para o caso de 1 dia, o usuário deve escolher entre meia ou sem pernoite
  const handleSingleDayChoice = (value: 'MEIA_DIARIA' | 'SEM_PERNOITE') => {
    setFormData(prev => {
      if (value === 'MEIA_DIARIA') {
        return { ...prev, tipo_diaria: 'MEIA_DIARIA', num_meia_diaria: 1, num_sem_pernoite: 0, num_com_pernoite: 0 };
      } else {
        return { ...prev, tipo_diaria: 'SEM_PERNOITE', num_meia_diaria: 0, num_sem_pernoite: 1, num_com_pernoite: 0 };
      }
    });
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <Paper sx={{ p: 3, maxWidth: 900, margin: 'auto' }}>
        <Typography variant="h5" component="h1" gutterBottom>Solicitação de Nova Diária</Typography>
        <Alert severity="info" sx={{ mt: 1, mb: 2 }}>
            <Typography variant="body2" color="text.primary">
                <strong>Formulário eletrônico para requisição de diárias</strong>, conforme a{' '}
                <Link 
                href="https://sapl.itapoa.sc.leg.br/media/sapl/public/normajuridica/2025/4799/resolucao_27_2025_1.pdf" 
                target="_blank" 
                rel="noopener noreferrer"
                >
                Resolução 27/2025
                </Link>
                . Todos os processos de requisição de diárias iniciam necessariamente a partir deste formulário eletrônico. As respostas deste formulário serão encaminhadas ao Departamento Administrativo, com uma cópia enviada ao e-mail do agente solicitante, para conferência. Caberá ao Departamento Administrativo dar andamento na solicitação, a partir das informações preenchidas neste formulário eletrônico.
            </Typography>
        </Alert>
        <Divider sx={{ my: 2 }} />

        <Typography variant="h6" gutterBottom>Dados do Solicitante</Typography>
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid container spacing={2}>
            <TextField label="Solicitante" value={`${user?.first_name || ''} ${user?.last_name || ''}`} fullWidth InputProps={{ readOnly: true }} variant="filled" />
          </Grid>
          <Grid container spacing={2}>
            <TextField label="CPF" value={user?.cpf || ''} fullWidth InputProps={{ readOnly: true }} variant="filled" />
          </Grid>
          <Grid container spacing={2}>
            <TextField label="Lotação" value={user?.lotacao || ''} fullWidth InputProps={{ readOnly: true }} variant="filled" />
          </Grid>
          <Grid container spacing={2}>
            <TextField label="Cargo/Função" value={user?.cargo || ''} fullWidth InputProps={{ readOnly: true }} variant="filled" />
          </Grid>
        </Grid>

        <Box component="form" noValidate autoComplete="off">
          <Grid container spacing={3}>
            <Grid size={{ xs: 12 }}><Typography variant="h6">Detalhes da Viagem</Typography></Grid>

            <Grid size={{ xs: 12, sm:4  }}>
              <DateTimePicker
                label="Data e Hora da Saída"
                value={formData.data_saida}
                onChange={(v) => handleDateChange('data_saida', v)}
                slotProps={{ textField: { fullWidth: true } }}
                ampm={false} // 24h
                format="DD/MM/YYYY HH:mm"
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 4 }}>
              <DateTimePicker
                label="Data e Hora do Retorno"
                value={formData.data_retorno}
                onChange={(v) => handleDateChange('data_retorno', v)}
                slotProps={{ textField: { fullWidth: true } }}
                ampm={false} // 24h
                format="DD/MM/YYYY HH:mm"
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField
                label="Número de diárias"
                value={numeroDeDiarias > 0 ? numeroDeDiarias : ''}
                fullWidth
                InputProps={{ readOnly: true }}
                variant="filled"
              />
            </Grid>

            <Grid size={{ xs: 12 }}>
              <FormControlLabel
                control={<Checkbox name="solicita_viagem_antecipada" checked={formData.solicita_viagem_antecipada} onChange={handleInputChange} />}
                label="Solicita viagem antecipada?"
              />
              {formData.solicita_viagem_antecipada && (
                <Alert severity="warning" sx={{ mt: 1 }}>
                  <b>Atenção:</b> ao selecionar esta opção, é obrigatório justificar (colocar em observações) o motivo do deslocamento antecipado, para que seja avaliada a possibilidade de concessão.
Além disso, a <b>DATA DE SAÍDA</b> informada acima deve corresponder ao dia real de início do deslocamento, ou seja, neste caso um dia antes do compromisso.
                </Alert>
              )}
            </Grid>

            {/* Autocomplete de destino */}
            {/* --- INÍCIO DA ALTERAÇÃO --- */}

            {/* Autocomplete de destino */}
            <Grid size={{ xs: 12, sm: 8 }}>
            <PlacesAutocomplete onSelect={handlePlaceSelect} />
            </Grid>

            {/* Campo para mostrar a distância calculada */}
            <Grid size={{ xs: 12, sm: 4 }}>
            <TextField
                label="Distância (ida e volta)"
                value={
                isCalculating ? 'Calculando...' :
                (calculoData.calculo_deslocamento.distancia_km > 0 ? `${calculoData.calculo_deslocamento.distancia_km} km` : '')
                }
                fullWidth
                InputProps={{ readOnly: true }}
                variant="filled"
            />
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
            <FormControl fullWidth required>
                <InputLabel>Meio de Transporte</InputLabel>
                <Select name="meio_transporte" value={formData.meio_transporte} label="Meio de Transporte" onChange={handleInputChange as any}>
                <MenuItem value="VEICULO_PROPRIO">Veículo Próprio</MenuItem>
                <MenuItem value="AEREO">Aéreo</MenuItem>
                <MenuItem value="ONIBUS">Transporte Rodoviário</MenuItem>
                <MenuItem value="CARONA">Carona (em veículo de outro servidor)</MenuItem>
                </Select>
            </FormControl>
            </Grid>

            {formData.meio_transporte === 'VEICULO_PROPRIO' && (
              <Grid container spacing={2}>
                <TextField name="placa_veiculo" label="Placa do carro" value={formData.placa_veiculo} onChange={handleInputChange} fullWidth />
              </Grid>
            )}

            {/* Tipo de diária + região */}
            <Grid size={{ xs: 12, sm: 4 }}>
              <FormControl fullWidth>
                <InputLabel>Região da Diária</InputLabel>
                <Select name="regiao_diaria" value={formData.regiao_diaria} onChange={handleInputChange as any} label="Região da Diária">
                  <MenuItem value="LOCAL">Florianópolis / Curitiba / Interior</MenuItem>
                  <MenuItem value="OUTROS">Outras Capitais / Exterior</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid size={{ xs: 12, sm: 4 }}>
                <FormControl fullWidth>
                    <InputLabel>Tipo de Diária </InputLabel>
                    <Select name="tipo_diaria" value={formData.tipo_diaria} onChange={handleInputChange as any} label="Tipo de Diária">
                    {/* A opção "Com Pernoite" só é renderizada se a viagem tiver mais de 1 dia */}
                    {numeroDeDiarias !== 1 && <MenuItem value="COM_PERNOITE">Com Pernoite</MenuItem>}
                    <MenuItem value="SEM_PERNOITE">Sem Pernoite</MenuItem>
                    <MenuItem value="MEIA_DIARIA">Meia Diária</MenuItem>
                    </Select>
                </FormControl>
            </Grid>

            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField name="valor_upm" label="Valor da UPM (R$)" value={formData.valor_upm} onChange={handleInputChange} type="number" fullWidth />
            </Grid>

            {/* Campos que mostram os contadores (são preenchidos pela lógica) */}
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField name="num_com_pernoite" label="Quant. Com Pernoite" value={formData.num_com_pernoite} onChange={handleInputChange} type="number" fullWidth />
            </Grid>

            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField name="num_sem_pernoite" label="Quant. Sem Pernoite" value={formData.num_sem_pernoite} onChange={handleInputChange} type="number" fullWidth />
            </Grid>

            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField name="num_meia_diaria" label="Quant. Meia Diária" value={formData.num_meia_diaria} onChange={handleInputChange} type="number" fullWidth />
            </Grid>

            {/* Ponto móvel obrigatório — já fixo como SIM */}
            <Grid size={{ xs: 12, sm: 4 }}>
              <FormControlLabel control={<Checkbox checked={true} name="ponto_movel_obrigatorio" disabled />} label="Sistema do Ponto Móvel (Obrigatório) - SIM" />
            </Grid>

            {/* Solicitação de Pagamento de Inscrição */}
            <Grid container spacing={2}>
              <FormControlLabel control={<Checkbox name="solicita_pagamento_inscricao" checked={formData.solicita_pagamento_inscricao} onChange={handleInputChange} />} label="Solicita Pagamento de Inscrição no Curso?" />
            </Grid>

            {formData.solicita_pagamento_inscricao && (
              <Grid container spacing={2}>
                <TextField name="valor_taxa_inscricao" label="Valor da Taxa (R$)" value={formData.valor_taxa_inscricao} onChange={handleInputChange} type="number" fullWidth />
              </Grid>
            )}

            {/* Se apenas 1 dia e tipo = COM_PERNOITE -> perguntar meia ou sem */}
            {numeroDeDiarias === 1 && formData.tipo_diaria === 'COM_PERNOITE' && (
              <Grid size={{ xs: 12 }}>
                <FormLabel component="legend">Você tem apenas 1 dia de deslocamento — escolha:</FormLabel>
                <RadioGroup row value={formData.tipo_diaria} onChange={(e) => handleSingleDayChoice(e.target.value as any)}>
                  <FormControlLabel value="MEIA_DIARIA" control={<Radio />} label="Meia Diária" />
                  <FormControlLabel value="SEM_PERNOITE" control={<Radio />} label="Sem Pernoite" />
                </RadioGroup>
                <Typography variant="caption">Como não há pernoite efetivo em 1 dia, escolha o enquadramento correto.</Typography>
              </Grid>
            )}

            {/* Anexos */}
            <Grid size={{ xs: 12 }}>
              <Typography variant="subtitle1">Anexar Imagem / Folder (será enviado ao Google Drive)</Typography>
              <input type="file" accept="image/*,application/pdf" onChange={handleImageSelect} />
              {imagePreview && <Box component="img" src={imagePreview} alt="preview" sx={{ maxWidth: '100%', mt: 2 }} />}
              <Button variant="outlined" sx={{ mt: 2 }} onClick={uploadFilesToDrive}>Enviar anexos para Google Drive</Button>
              <Typography variant="caption" display="block">Pasta de destino: (defina no backend)</Typography>
            </Grid>

            <Grid size={{ xs: 12 }}>
              <TextField name="observacoes" label="Observações (opcional)" value={formData.observacoes} onChange={handleInputChange} multiline rows={3} fullWidth />
            </Grid>

            {/* Cálculo preview (tabela) */}
            <Grid size={{ xs: 12 }}><Typography variant="h6">CÁLCULO DO VALOR DAS DIÁRIAS</Typography></Grid>

            <Grid size={{ xs: 12 }}>
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead sx={{ backgroundColor: '#eee' }}>
                    <TableRow>
                      <TableCell>Diárias</TableCell>
                      <TableCell align="center">Quantidade</TableCell>
                      <TableCell>UPM x Valor</TableCell>
                      <TableCell align="right">Total</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    <TableRow>
                      <TableCell>Com Pernoite</TableCell>
                      <TableCell align="center">{calculoData.calculo_diarias.num_com_pernoite || '--'}</TableCell>
                      <TableCell>{`${calculoData.calculo_diarias.upm_com_pernoite} UPM x ${formatCurrency(calculoData.calculo_diarias.valor_upm_usado)}`}</TableCell>
                      <TableCell align="right">{formatCurrency(calculoData.calculo_diarias.total_com_pernoite)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Sem Pernoite</TableCell>
                      <TableCell align="center">{calculoData.calculo_diarias.num_sem_pernoite || '--'}</TableCell>
                      <TableCell>{`${calculoData.calculo_diarias.upm_sem_pernoite} UPM x ${formatCurrency(calculoData.calculo_diarias.valor_upm_usado)}`}</TableCell>
                      <TableCell align="right">{formatCurrency(calculoData.calculo_diarias.total_sem_pernoite)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Meia Diária</TableCell>
                      <TableCell align="center">{calculoData.calculo_diarias.num_meia_diaria || '--'}</TableCell>
                      <TableCell>{`${calculoData.calculo_diarias.upm_meia_diaria} UPM x ${formatCurrency(calculoData.calculo_diarias.valor_upm_usado)}`}</TableCell>
                      <TableCell align="right">{formatCurrency(calculoData.calculo_diarias.total_meia_diaria)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell colSpan={3} align="right"><b>Total Diárias</b></TableCell>
                      <TableCell align="right"><b>{formatCurrency(calculoData.calculo_diarias.valor_total_diarias)}</b></TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
            </Grid>

            {/* Deslocamento (condicional) */}
            {formData.meio_transporte === 'VEICULO_PROPRIO' && (
              <Grid size={{ xs: 12 }}>
                <Typography variant="h6" sx={{ mt: 2 }}>Deslocamento (Para uso de veículo próprio)</Typography>
                <Typography variant="caption">Valor = (Distância Total ÷ 10) × Preço Médio da Gasolina</Typography>

                <TableContainer component={Paper} variant="outlined" sx={{ mt: 1 }}>
                  <Table size="small">
                    <TableHead sx={{ backgroundColor: '#eee' }}>
                      <TableRow>
                        <TableCell>Km Total (ida e volta)</TableCell>
                        <TableCell>Preço médio Gasolina</TableCell>
                        <TableCell align="right">Total</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      <TableRow>
                        <TableCell>{calculoData.calculo_deslocamento.distancia_km || '--'} km</TableCell>
                        <TableCell>{formatCurrency(calculoData.calculo_deslocamento.preco_gas_usado)}</TableCell>
                        <TableCell align="right">{formatCurrency(calculoData.calculo_deslocamento.valor_deslocamento)}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </TableContainer>

                <Button sx={{ mt: 1 }} onClick={() => {
                  // dev helper
                  setCalculoData(prev => ({ ...prev, calculo_deslocamento: { ...prev.calculo_deslocamento, distancia_km: 120 } }));
                }}>Simular distância 120 km</Button>
              </Grid>
            )}

            <Grid size={{ xs: 12 }}>
              <Typography variant="h5" align="right">
                TOTAL A EMPENHAR: <b>{formatCurrency(calculoData.total_empenhar)}</b>
              </Typography>
            </Grid>

            <Grid size={{ xs: 12 }}><Divider sx={{ my: 2 }} /></Grid>

            <Grid size={{ xs: 12 }} sx={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button variant="contained" color="primary" size="large">Enviar Solicitação</Button>
            </Grid>
          </Grid>
        </Box>
      </Paper>
    </LocalizationProvider>
  );
};

export default NovaDiaria;
