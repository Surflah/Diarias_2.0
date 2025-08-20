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
  justificativa_viagem_antecipada: string;

  // campos mantidos para uso interno (agora calculados automaticamente)
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
  justificativa_viagem_antecipada: '',
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
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // novos estados locais
  const [capitalsList, setCapitalsList] = useState<string[]>([]);
  const [isLoadingConfig, setIsLoadingConfig] = useState(false);

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement> | any) => {
    const { name, value, type, checked } = event.target;
    // nota: não permitir que o usuário altere campos calculados (valor_upm, num_*)
    if (['valor_upm', 'num_com_pernoite', 'num_sem_pernoite', 'num_meia_diaria', 'regiao_diaria'].includes(name)) {
      return;
    }
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : (type === 'number' ? (Number(value) || 0) : value),
    }));
  };

   const handleSubmit = async () => {
    const errors: Record<string, string> = {};
    if (formData.solicita_viagem_antecipada) {
      if (!formData.justificativa_viagem_antecipada || formData.justificativa_viagem_antecipada.trim() === '') {
        errors.justificativa_viagem_antecipada = 'Informe a justificativa da viagem antecipada.';
      }
    }

    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      // scroll to the field for better UX
      const el = document.getElementsByName('justificativa_viagem_antecipada')[0] as HTMLElement | undefined;
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    // TODO: integrar com o envio real para o backend
    // Exemplo: montar payload e chamar apiClient.post('/processos/solicitar/', payload)
    // Por enquanto apenas console log para verificar
    console.debug('Form ready to submit, payload:', formData);
    // substituir pelo envio real quando integrar
  };

  const currencyFormatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

  const formatCurrencyInput = (v: number) => {
    // sempre retorna algo como "R$ 0,00"
    return currencyFormatter.format(Number(v || 0));
  };

  const handleValorTaxaChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    // mantém somente dígitos; considera últimos 2 como centavos
    const raw = e.target.value || '';
    const digits = raw.replace(/\D/g, '');
    const cents = digits === '' ? 0 : parseInt(digits, 10);
    const value = cents / 100;
    setFormData(prev => ({ ...prev, valor_taxa_inscricao: value }));
  };


  const handleDateChange = (name: string, newValue: Dayjs | null) => {
    setFormData(prev => ({ ...prev, [name]: newValue }));
  };

  const numeroDeDiarias = formData.data_saida && formData.data_retorno
    ? formData.data_retorno.diff(formData.data_saida, 'day') + 1
    : 0;

  // busca config (valor_upm e capitais) ao montar
  useEffect(() => {
    const loadConfig = async () => {
      setIsLoadingConfig(true);
      try {
        const res = await apiClient.get('/config/');
        const valorUpm = Number(res.data.valor_upm) || initialFormData.valor_upm;
        const capitais = Array.isArray(res.data.capitais) ? res.data.capitais : [];
        setCapitalsList(capitais.map((c: string) => c.toLowerCase()));
        setFormData(prev => ({ ...prev, valor_upm: valorUpm }));
      } catch (err) {
        console.warn('Erro ao carregar config /config/:', err);
      } finally {
        setIsLoadingConfig(false);
      }
    };
    loadConfig();
  }, []);

    const triggerCalculation = useCallback(async (optionalDestino?: string) => {
    // validações rápidas
    if (!formData.data_saida || !formData.data_retorno) return;
    if (!formData.data_retorno.isAfter(formData.data_saida) && !formData.data_retorno.isSame(formData.data_saida)) return;

    const destinoToSend = optionalDestino ?? formData.destino;
    if (!destinoToSend) return;

    setIsCalculating(true);
    setCalculoError('');

    try {
        const payload: any = {
        destino: destinoToSend,
        data_saida: formData.data_saida.toISOString(),
        data_retorno: formData.data_retorno.toISOString(),
        num_com_pernoite: formData.num_com_pernoite,
        num_sem_pernoite: formData.num_sem_pernoite,
        num_meia_diaria: formData.num_meia_diaria,
        regiao_diaria: formData.regiao_diaria,
        };

        if (formData.meio_transporte && formData.meio_transporte.trim() !== '') {
        payload.meio_transporte = formData.meio_transporte;
        }

        // DEBUG: inspeccionar payload no console (remova em prod)
        console.debug('triggerCalculation payload:', payload);

        const response = await apiClient.post<CalculoData>('/processos/calcular-preview/', payload);

        // atualiza cálculo exibido
        setCalculoData(response.data);

        // atualiza campos internos (sincronizar com o que backend retornou)
        setFormData(prev => ({
        ...prev,
        num_com_pernoite: response.data.calculo_diarias.num_com_pernoite ?? 0,
        num_sem_pernoite: response.data.calculo_diarias.num_sem_pernoite ?? 0,
        num_meia_diaria: response.data.calculo_diarias.num_meia_diaria ?? 0,
        valor_upm: response.data.calculo_diarias.valor_upm_usado ?? prev.valor_upm,
        }));
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
    // inclua todas as dependências usadas dentro da função
    }, [
        formData.data_saida,
        formData.data_retorno,
        formData.destino,
        formData.meio_transporte,
        formData.num_com_pernoite,
        formData.num_sem_pernoite,
        formData.num_meia_diaria,
        formData.regiao_diaria,
        formData.valor_upm,
    ]);

    useEffect(() => {
        // evita disparo quando dados mínimos não estão prontos
        if (!formData.data_saida || !formData.data_retorno) return;
        if (!formData.destino) return;

        // dispara cálculo (sem destino opcional — usa o formData.destino atual)
        triggerCalculation();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        formData.destino,
        formData.data_saida,
        formData.data_retorno,
        formData.meio_transporte,
        formData.regiao_diaria,
        formData.num_com_pernoite,
        formData.num_sem_pernoite,
        formData.num_meia_diaria,
        triggerCalculation,
    ]);
  // quando user seleciona lugar no autocomplete: agora recebe objeto com address components
  const handlePlaceSelect = (selection: {
    description: string;
    placeId?: string;
    addressComponents?: google.maps.GeocoderAddressComponent[];
    latLng?: { lat: number; lng: number };
  }) => {
    const { description, addressComponents } = selection;
    // seta destino
    setFormData(prev => ({ ...prev, destino: description }));

    // inferir cidade a partir dos address components (preferencial) ou da string
    const getCityFromAddressComponents = (comps?: google.maps.GeocoderAddressComponent[]) => {
      if (!comps || comps.length === 0) return '';
      const cityComp = comps.find(c => c.types.includes('administrative_area_level_2')) ||
                       comps.find(c => c.types.includes('locality')) ||
                       comps.find(c => c.types.includes('sublocality')) ||
                       comps.find(c => c.types.includes('administrative_area_level_1'));
      return cityComp ? cityComp.long_name.toLowerCase() : '';
    };

    const city = getCityFromAddressComponents(addressComponents) || description.split(',')[0].trim().toLowerCase();

    // inferir região usando a lista de capitais carregada
    const inferRegion = (cityName: string): Region => {
      const normalized = cityName.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
      // tratar casos explícitos
      if (normalized === 'florianopolis' || normalized === 'florianópolis' || normalized === 'curitiba') return 'LOCAL';
      if (normalized === 'brasilia' || normalized === 'brasília') return 'OUTROS';
      // se estiver na lista de capitais -> OUTROS, senão -> LOCAL (interior)
      if (capitalsList.length > 0 && capitalsList.includes(normalized)) return 'OUTROS';
      return 'LOCAL';
    };

    const inferredRegion = inferRegion(city);

    // atualiza state (regiao calculada) — não exposto ao usuário para alteração manual
    setFormData(prev => ({ ...prev, regiao_diaria: inferredRegion }));

    // dispara cálculo (preview) com o destino selecionado
    triggerCalculation(description);
  };

  // Função que aplica a lógica de distribuição das diárias conforme regras
  const applyDiariasDistribution = useCallback(() => {
    const N = numeroDeDiarias;
    let num_com = 0, num_sem = 0, num_meia = 0;
    const tipo = formData.tipo_diaria;
    const antecipada = formData.solicita_viagem_antecipada;

    if (N <= 0) {
      num_com = num_sem = num_meia = 0;
    } else if (N === 1) {
      if (tipo === 'SEM_PERNOITE') {
        num_sem = 1;
      } else if (tipo === 'MEIA_DIARIA') {
        num_meia = 1;
      } else {
        // manter sem alterar; UI de escolha lida com isso
      }
    } else { // N >= 2
      if (tipo === 'SEM_PERNOITE') {
        num_sem = N;
      } else if (tipo === 'MEIA_DIARIA') {
        num_meia = N;
      } else if (tipo === 'COM_PERNOITE') {
        if (antecipada) {
          num_meia = 1;
          num_com = N - 1;
        } else {
          num_com = N - 1;
          num_sem = 1;
        }
      }
    }

    // grava os valores calculados no state (interno)
    setFormData(prev => ({
      ...prev,
      num_com_pernoite: num_com,
      num_sem_pernoite: num_sem,
      num_meia_diaria: num_meia,
    }));
  }, [numeroDeDiarias, formData.tipo_diaria, formData.solicita_viagem_antecipada]);

  useEffect(() => {
    applyDiariasDistribution();
  }, [applyDiariasDistribution]);

  useEffect(() => {
    if (numeroDeDiarias === 1 && formData.tipo_diaria === 'COM_PERNOITE') {
      setFormData(prev => ({ ...prev, tipo_diaria: 'SEM_PERNOITE' }));
    }
  }, [numeroDeDiarias, formData.tipo_diaria]);

  // cálculos monetários + deslocamento (usando UPM_TABLE + distancia vindo de calculoData)
  // cálculos monetários + deslocamento (usando UPM_TABLE + distancia vindo de calculoData)
// Substituir o useEffect antigo por este bloco
// cálculos monetários + deslocamento (usando UPM_TABLE + distancia vindo de calculoData)
useEffect(() => {
    // Prioridade: usar valores que já vieram do backend (calculoData), mas permitir overrides vindos do frontend (formData.num_*)
    const valorUpm = Number((calculoData?.calculo_diarias?.valor_upm_usado ?? formData.valor_upm) || 0);

    const num_com = Number(formData.num_com_pernoite || calculoData.calculo_diarias.num_com_pernoite || 0);
    const num_sem = Number(formData.num_sem_pernoite || calculoData.calculo_diarias.num_sem_pernoite || 0);
    const num_meia = Number(formData.num_meia_diaria || calculoData.calculo_diarias.num_meia_diaria || 0);

    const region = formData.regiao_diaria || 'LOCAL';

    const upmCom = UPM_TABLE[region].COM_PERNOITE;
    const upmSem = UPM_TABLE[region].SEM_PERNOITE;
    const upmMeia = UPM_TABLE[region].MEIA_DIARIA;

    // cálculo local (se backend não tiver retornado)
    const totalUpm = (num_com * upmCom) + (num_sem * upmSem) + (num_meia * upmMeia);
    const local_valor_total_diarias = totalUpm * valorUpm;

    // preferir o valor do backend se disponível
    const valor_total_diarias = Number(calculoData?.calculo_diarias?.valor_total_diarias ?? local_valor_total_diarias);

    // deslocamento: preferir o valor calculado pelo backend (se disponível)
    const distancia_km = calculoData.calculo_deslocamento.distancia_km || 0;
    const preco_gas = Number(calculoData.calculo_deslocamento.preco_gas_usado) || 0;
    const valor_deslocamento =
    formData.meio_transporte === 'VEICULO_PROPRIO'
        ? (distancia_km / 10) * preco_gas
        : 0;

    // --- ATENÇÃO: somar deslocamento somente se veículo próprio ---
    const incluirDeslocamento = formData.meio_transporte === 'VEICULO_PROPRIO';
    const total_empenhar = Number(valor_total_diarias || 0) + (incluirDeslocamento ? Number(valor_deslocamento || 0) : 0);


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
        distancia_km: distancia_km || prev.calculo_deslocamento.distancia_km,
        preco_gas_usado: preco_gas || prev.calculo_deslocamento.preco_gas_usado,
        valor_deslocamento,
        },
        total_empenhar,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
    formData.num_com_pernoite,
    formData.num_sem_pernoite,
    formData.num_meia_diaria,
    formData.regiao_diaria,
    formData.valor_upm,
    formData.solicita_pagamento_inscricao,
    formData.valor_taxa_inscricao,
    calculoData.calculo_deslocamento.distancia_km,
    formData.meio_transporte,
    ]);

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
          {/* Cada campo em sua própria linha para dar espaço para preenchimentos longos */}
          <Grid size={{ xs: 12 }}>
            <TextField
              label="Solicitante"
              value={`${user?.first_name || ''} ${user?.last_name || ''}`}
              fullWidth
              InputProps={{ readOnly: true }}
              variant="filled"
            />
          </Grid>

          <Grid size={{ xs: 12 }}>
            <TextField
              label="CPF"
              value={user?.cpf || ''}
              fullWidth
              InputProps={{ readOnly: true }}
              variant="filled"
            />
          </Grid>

          <Grid size={{ xs: 12 }}>
            <TextField
              label="Lotação"
              value={user?.lotacao || ''}
              fullWidth
              InputProps={{ readOnly: true }}
              variant="filled"
            />
          </Grid>

          <Grid size={{ xs: 12 }}>
            <TextField
              label="Cargo/Função"
              value={user?.cargo || ''}
              fullWidth
              InputProps={{ readOnly: true }}
              variant="filled"
            />
          </Grid>

        </Grid>

        <Box component="form" noValidate autoComplete="off">
          <Grid container spacing={3}>
            <Grid size={{ xs: 12 }}><Typography variant="h6">Detalhes da Viagem</Typography></Grid>

            <Grid size={{ xs: 12 }}>
              <TextField
                name="finalidade_viagem"
                label="Apresentar justificativa pormenorizada para a requisição da diária."
                placeholder="Apresentar justificativa pormenorizada para a requisição da diária."
                value={formData.finalidade_viagem}
                onChange={handleInputChange}
                multiline
                rows={4}
                fullWidth
                sx={{ mb: 1 }}
                helperText="Descreva a finalidade da viagem (objetivos, atividades previstas, etc.)."
              />
            </Grid>

            {/* Datas e número de diárias: mesma linha responsiva */}
            <Grid size={{ xs: 12, sm: 6, md: 4 }}>
              <DateTimePicker
                label="Data e Hora da Saída"
                value={formData.data_saida}
                onChange={(v) => handleDateChange('data_saida', v)}
                slotProps={{ textField: { fullWidth: true } }}
                ampm={false}
                format="DD/MM/YYYY HH:mm"
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 6, md: 4 }}>
              <DateTimePicker
                label="Data e Hora do Retorno"
                value={formData.data_retorno}
                onChange={(v) => handleDateChange('data_retorno', v)}
                slotProps={{ textField: { fullWidth: true } }}
                ampm={false}
                format="DD/MM/YYYY HH:mm"
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 12, md: 4 }}>
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

              {formData.solicita_viagem_antecipada ? (
                <TextField
                  name="justificativa_viagem_antecipada"
                  label="Justificativa da viagem antecipada"
                  value={formData.justificativa_viagem_antecipada}
                  onChange={handleInputChange}
                  multiline
                  rows={3}
                  required
                  fullWidth
                  sx={{ mt: 1 }}
                  error={!!fieldErrors.justificativa_viagem_antecipada}
                  helperText={
                    fieldErrors.justificativa_viagem_antecipada
                      ?? 'A DATA DE SAÍDA deve corresponder ao início real do deslocamento, ou seja, neste caso um dia antes do compromisso.'
                  }
                />
              ) : (
                <Alert severity="info" sx={{ mt: 1 }}>
                   Se for necessário viajar um dia antes — por exemplo, quando o compromisso inicia de manhã em uma cidade distante — marque a opção acima e informe a justificativa.
                </Alert>
              )}

          <Grid size={{ xs: 12, sm: 6, md: 6 }} sx={{ mt: 3 }}>
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

          <Grid size={{ xs: 12, sm: 6, md: 6 }} sx={{ mt: 3 }}>
            <FormControl fullWidth>
              <InputLabel>Tipo de Diária</InputLabel>
              <Select
                name="tipo_diaria"
                value={formData.tipo_diaria}
                onChange={handleInputChange as any}
                label="Tipo de Diária"
              >
                {numeroDeDiarias !== 1 && <MenuItem value="COM_PERNOITE">Com Pernoite</MenuItem>}
                <MenuItem value="SEM_PERNOITE">Sem Pernoite</MenuItem>
                <MenuItem value="MEIA_DIARIA">Meia Diária</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          

            </Grid>

            {/* Autocomplete de destino - agora retorna address components */}
            <Grid size={{ xs: 12, sm: 8 }}>
              <PlacesAutocomplete onSelect={handlePlaceSelect} />
              <Typography variant="caption" display="block">
                O Sistema deve identificar o endereço de destino, caso não aconteça infrome o administrador.
              </Typography>
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

            {/* Ponto móvel obrigatório — já fixo como SIM */}
            <Grid size={{ xs: 12, sm: 4 }}>
              <FormControlLabel control={<Checkbox checked={true} name="ponto_movel_obrigatorio" disabled />} label="Sistema do Ponto Móvel (Obrigatório) - SIM" />
            </Grid>

            {/* Solicitação de Pagamento de Inscrição */}
            <Grid container spacing={2} alignItems="center">
              <Grid size={{ xs: 12, sm: 8 }}>
                <FormControlLabel
                  control={
                    <Checkbox
                      name="solicita_pagamento_inscricao"
                      checked={formData.solicita_pagamento_inscricao}
                      onChange={handleInputChange}
                    />
                  }
                  label="Solicita Pagamento de Inscrição no Curso?"
                />
              </Grid>

              <Grid size={{ xs: 12, sm: 4 }}>
                {formData.solicita_pagamento_inscricao && (
                  <TextField
                    name="valor_taxa_inscricao"
                    label="Valor da Taxa (R$)"
                    value={formatCurrencyInput(formData.valor_taxa_inscricao)}
                    onChange={handleValorTaxaChange}
                    inputProps={{ inputMode: 'numeric', pattern: '[0-9]*' }}
                    fullWidth
                    helperText=""
                  />
                )}
              </Grid>
            </Grid>

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
              <Typography variant="subtitle1">Anexar Imagem / Folder ou outros documentos</Typography>
              <input type="file" accept="image/*,application/pdf" onChange={handleImageSelect} />
              {imagePreview && <Box component="img" src={imagePreview} alt="preview" sx={{ maxWidth: '100%', mt: 2 }} />}
              <Typography variant="caption" display="block"></Typography>
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

            {/* --- Seção adicionada: Informações sobre assinaturas (texto informativo) --- */}
            <Grid size={{ xs: 12 }} sx={{ mt: 2 }}>
            <Typography variant="h6">Informações:</Typography>


              <Alert severity="info" sx={{ p: 2, mt: 1 }}>
                <Typography variant="subtitle2"><b>ASSINATURA DIGITAL DO AGENTE SOLICITANTE</b></Typography>
                <Typography variant="body2" sx={{ mt: 1 }}>
                  Todos os agentes políticos ou servidores devem necessariamente assinar a requisição de diária com o certificado digital no padrão ICP-Brasil, conforme e-mail da assinatura@camaraitapoa.sc.gov.br. Somente se considerará efetivada a requisição após a coleta de assinatura digital na requisição de diária.
                </Typography>
              </Alert>


              <Alert severity="info" sx={{ p: 2, mt: 2 }}>
                <Typography variant="subtitle2"><b>ASSINATURA DIGITAL DO PRESIDENTE</b></Typography>
                <Typography variant="body2" sx={{ mt: 1 }}>
                  O Presidente da Mesa Diretora, na qualidade de Ordenador de Despesas, deverá autorizar e assinar o presente requerimento, se atendidas as formalidades legais requeridas para a concessão de diárias no âmbito da Câmara Municipal de Itapoá, sem prejuízo da obrigatória prestação de contas pelo agente beneficiário no prazo de até 5 (cinco) dias úteis contados a partir do último dia do recebimento de diária.
                </Typography>
              </Alert>


              <Alert severity="info" sx={{ p: 2, mt: 2 }}>
                <Typography variant="subtitle2"><b>Observações:</b></Typography>
                <Typography variant="body2" sx={{ mt: 1 }}>
                Documento deverá ser assinado digitalmente pelo agente requerente, em conformidade com o art. 45, §4º, da Lei Orgânica de Itapoá, Resolução nº 14/2016, Portaria 254/21 e conforme as regras da infraestrutura ICP-Brasil. Todas as informações incluídas neste formulário são de inteira responsabilidade do respectivo agente requerente que preencher as informações, inclusive os documentos anexados, e a autenticidade se dá a partir do vínculo do e-mail oficial do respectivo agente requerente, com observância do termo de uso do e-mail oficial. Após preencher o presente formulário e clicar no botão "Enviar", a Casa dará andamento no processo, analisará a documentação, desenvolverá os documentos conforme a Resolução nº 27/2025, e enviará para aprovação e assinatura digital do agente requerente e do ordenador de despesas.
                </Typography>
              </Alert>

            </Grid>

          </Grid>
        </Box>
      </Paper>
    </LocalizationProvider>
  );
};

export default NovaDiaria;


