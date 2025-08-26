// frontend/src/pages/ProcessoDetalhe.tsx

import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Box, Card, CardContent, Typography, Stepper, Step, StepLabel, TextField, Button, Stack, Divider } from '@mui/material';
import apiClient from '../api/axiosConfig';

type Processo = {
  id: number;
  numero?: number;
  ano?: number;
  status: string;
  status_display: string;
  objetivo_viagem: string;
  destino: string;
  solicitante_nome: string;
  allowed_actions?: string[];
};

type Historico = {
  id: number; status_anterior: string; status_novo: string; timestamp: string; responsavel_nome: string; anotacao: string;
};

type Anotacao = { id: number; texto: string; autor_nome: string; created_at: string; };

const STEPS = [
  { code: 'ANALISE_ADMIN', label: 'Análise Administrativa' },
  { code: 'AGUARDANDO_ASSINATURAS_SOLICITACAO', label: 'Assinaturas (Solicitação)' },
  { code: 'AGUARDANDO_INSCRICAO', label: 'Aguardando inscrição' },
  { code: 'AGUARDANDO_EMPENHO', label: 'Aguardando empenho' },
  { code: 'AGUARDANDO_PAGAMENTO', label: 'Aguardando pagamento' },
  { code: 'AGUARDANDO_PC', label: 'Aguardando Prestação de Contas' },
  { code: 'PC_EM_ANALISE', label: 'PC – Análise (CI)' },
  { code: 'AGUARDANDO_ASSINATURAS_PC', label: 'PC – Assinaturas' },
  { code: 'PC_ANALISE_CONTABILIDADE', label: 'PC – Contabilidade' },
  { code: 'ARQUIVADO', label: 'Arquivado' },
];

export default function ProcessoDetalhe() {
  const { id } = useParams();
  const [proc, setProc] = useState<Processo | null>(null);
  const [hist, setHist] = useState<Historico[]>([]);
  const [notes, setNotes] = useState<Anotacao[]>([]);
  const [novaNota, setNovaNota] = useState('');
  const [destino, setDestino] = useState<string>('');
  const [loading, setLoading] = useState(true);

  const currentStep = useMemo(() => {
    const idx = STEPS.findIndex(s => s.code === proc?.status);
    return idx >= 0 ? idx : 0;
  }, [proc]);

  async function loadAll() {
    setLoading(true);
    const [p, h, a] = await Promise.all([
      apiClient.get(`/processos/${id}/`),
      apiClient.get(`/processos/${id}/historico/`),
      apiClient.get(`/processos/${id}/anotacoes/`),
    ]);
    setProc(p.data);
    setDestino(p.data.allowed_actions?.[0] || '');
    setHist(h.data);
    setNotes(a.data);
    setLoading(false);
  }

  useEffect(() => { loadAll().catch(console.error); /* eslint-disable-next-line */ }, [id]);

  async function sendNote() {
    if (!novaNota.trim()) return;
    const { data } = await apiClient.post(`/processos/${id}/anotacoes/`, { texto: novaNota.trim() });
    setNotes(prev => [...prev, data]);
    setNovaNota('');
  }

  async function doTransicao() {
    if (!destino) return;
    const { data } = await apiClient.post(`/processos/${id}/transicionar/`, { destino });
    setProc(p => p ? { ...p, status: data.status } : p);
    if (data.historico?.length) setHist(h => [...h, ...data.historico]);
    // recarrega allowed_actions
    const p = await apiClient.get(`/processos/${id}/`);
    setProc(p.data);
    setDestino(p.data.allowed_actions?.[0] || '');
  }

  if (loading || !proc) return <Box p={3}><Typography>Carregando...</Typography></Box>;

  return (
    <Box p={3}>
      <Typography variant="h5" gutterBottom>
        Processo {proc.numero ? `${proc.numero}-${proc.ano}` : `#${proc.id}`} — {proc.solicitante_nome}
      </Typography>
      <Typography variant="body2" gutterBottom color="text.secondary">
        Destino: {proc.destino} • Status: {proc.status_display}
      </Typography>

      <Card sx={{ mt: 2, mb: 3 }}>
        <CardContent>
          <Stepper activeStep={currentStep} alternativeLabel>
            {STEPS.map((s) => (
              <Step key={s.code}>
                <StepLabel>{s.label}</StepLabel>
              </Step>
            ))}
          </Stepper>
        </CardContent>
      </Card>

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="flex-start">
        <Card sx={{ flex: 1 }}>
          <CardContent>
            <Typography variant="h6">Histórico</Typography>
            <Divider sx={{ my: 1 }} />
            {hist.length === 0 && <Typography variant="body2">Sem movimentações.</Typography>}
            {hist.map(h => (
              <Box key={h.id} sx={{ mb: 1.5 }}>
                <Typography variant="body2">
                  <strong>{h.responsavel_nome}</strong> • {new Date(h.timestamp).toLocaleString()}
                </Typography>
                <Typography variant="body2">
                  {h.status_anterior || '—'} → <strong>{h.status_novo}</strong>
                </Typography>
                {h.anotacao && <Typography variant="body2">{h.anotacao}</Typography>}
              </Box>
            ))}
          </CardContent>
        </Card>

        <Card sx={{ flex: 1 }}>
          <CardContent>
            <Typography variant="h6">Anotações</Typography>
            <Divider sx={{ my: 1 }} />
            <Box sx={{ maxHeight: 320, overflow: 'auto', mb: 2, pr: 1 }}>
              {notes.length === 0 && <Typography variant="body2">Sem anotações.</Typography>}
              {notes.map(n => (
                <Box key={n.id} sx={{ mb: 1.5 }}>
                  <Typography variant="body2"><strong>{n.autor_nome}</strong> • {new Date(n.created_at).toLocaleString()}</Typography>
                  <Typography variant="body2">{n.texto}</Typography>
                </Box>
              ))}
            </Box>
            <Stack direction="row" spacing={1}>
              <TextField
                fullWidth
                size="small"
                placeholder="Escreva uma anotação…"
                value={novaNota}
                onChange={e => setNovaNota(e.target.value)}
              />
              <Button variant="contained" onClick={sendNote}>Enviar</Button>
            </Stack>
          </CardContent>
        </Card>

        <Card sx={{ width: 320 }}>
          <CardContent>
            <Typography variant="h6">Ações</Typography>
            <Divider sx={{ my: 1 }} />
            {proc.allowed_actions && proc.allowed_actions.length > 0 ? (
              <>
                <TextField
                  select
                  SelectProps={{ native: true }}
                  label="Próximo status"
                  fullWidth
                  size="small"
                  value={destino}
                  onChange={e => setDestino(e.target.value)}
                >
                  {proc.allowed_actions.map(a => <option key={a} value={a}>{a}</option>)}
                </TextField>
                <Button sx={{ mt: 2 }} variant="contained" fullWidth onClick={doTransicao}>
                  Executar
                </Button>
              </>
            ) : (
              <Typography variant="body2">Nenhuma ação permitida para seu perfil neste status.</Typography>
            )}
          </CardContent>
        </Card>
      </Stack>
    </Box>
  );
}
