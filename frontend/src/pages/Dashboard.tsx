// frontend/src/pages/Dashboard.tsx

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import apiClient from '../api/axiosConfig';
import {
   Box,
   Container,
   Typography,
   Card,
   CardContent,
   CardActionArea,
   Chip,
   CircularProgress,
   Alert,
   Tabs,
   Tab,
 } from '@mui/material';
 // Grid2 (usa a prop `size={{ xs, sm, md }}`)
import { Grid } from '@mui/material';
import dayjs from 'dayjs';

// Interfaces para os dados da API
interface Processo {
  id: number;
  numero: number;
  ano: number;
  solicitante_nome: string;
  destino: string;
  status: string;
  status_display: string;
  created_at: string;
}

interface PaginatedResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: Processo[];
}

// Helper para colorir o status
const getStatusChipColor = (status: string): "success" | "warning" | "error" | "info" | "default" => {
  if (status.includes('INDEFERIDO') || status.includes('CANCELADO')) return 'error';
  if (status.includes('ARQUIVADO')) return 'success';
  if (status.includes('PENDENTE') || status.includes('CORRECAO')) return 'warning';
  if (status.includes('PAGAMENTO') || status.includes('PAGA')) return 'info';
  return 'default';
};

const Dashboard: React.FC = () => {
  const { user, activeRole } = useAuth();
  const navigate = useNavigate();

  const [processes, setProcesses] = useState<Processo[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  // Estado para paginação
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // Estado para as abas
  const [tabValue, setTabValue] = useState(0);

  const observer = useRef<IntersectionObserver | null>(null);
  const lastProcessElementRef = useCallback((node: HTMLDivElement | null) => {
    if (loading || loadingMore) return;
    if (observer.current) observer.current.disconnect();
    
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        setPage(prevPage => prevPage + 1);
      }
    });

    if (node) observer.current.observe(node);
  }, [loading, loadingMore, hasMore]);

  useEffect(() => {
    return () => { if (observer.current) observer.current.disconnect(); };
  }, [tabValue]);

  const fetchProcesses = useCallback(async (currentPage: number, view: string) => {
    if (currentPage > 1) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const response = await apiClient.get<PaginatedResponse>('/processos/', {
        params: { page: currentPage, view: view }
      });
      
      setProcesses(prev => currentPage === 1 ? response.data.results : [...prev, ...response.data.results]);
      setHasMore(response.data.next !== null);
    } catch (err) {
      setError("Falha ao carregar os processos. Tente novamente mais tarde.");
      console.error(err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
    setProcesses([]);
    setPage(1);
    setHasMore(true);
  };
  
  const getRoleBasedTabs = () => {
    if (activeRole === 'solicitante') {
      return [
        { label: 'Diárias em Andamento', view: 'in_progress' },
        { label: 'Diárias Finalizadas', view: 'finished' }
      ];
    }
    // Para outros perfis (operadores)
    return [
      { label: 'Aguardando Minha Ação', view: 'action_needed' },
      { label: 'Todos os Processos', view: 'all' }
    ];
  };

  const tabs = getRoleBasedTabs();
  const currentView = tabs[tabValue].view;

  useEffect(() => {
    // Se a página for 1, faz o fetch inicial ou ao mudar de aba
    if (page === 1) {
      fetchProcesses(1, currentView);
    }
  }, [page, currentView, fetchProcesses]);

  useEffect(() => {
    // Se a página for > 1 (scroll), faz o fetch da próxima página
    if (page > 1) {
      fetchProcesses(page, currentView);
    }
  }, [page]);


  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Painel de Controle
      </Typography>
      <Typography variant="subtitle1" color="text.secondary" sx={{ mb: 2 }}>
        Bem-vindo(a), {user?.first_name}. Visualizando como: <strong>{activeRole}</strong>
      </Typography>

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={tabValue} onChange={handleTabChange} aria-label="abas do dashboard">
          {tabs.map(tab => <Tab label={tab.label} key={tab.view} />)}
        </Tabs>
      </Box>

      {loading && <Box sx={{ display: 'flex', justifyContent: 'center', my: 5 }}><CircularProgress /></Box>}
      {error && <Alert severity="error">{error}</Alert>}
      
      {!loading && !error && (
        <>
          <Grid container spacing={3}>
            {processes.map((proc, index) => {
                const isLastElement = processes.length === index + 1;
                return (
                <Grid key={proc.id} size={{ xs: 12, sm: 6, md: 4 }}>
                    <Box ref={isLastElement ? lastProcessElementRef : undefined}>
                    <CardActionArea onClick={() => navigate(`/processos/${proc.id}`)}>
                        <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                        <CardContent sx={{ flexGrow: 1 }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <Typography variant="h6" component="h2">
                                Processo {proc.numero}/{proc.ano}
                            </Typography>
                            <Chip label={proc.status_display} color={getStatusChipColor(proc.status)} size="small" />
                            </Box>
                            <Typography color="text.secondary" sx={{ mb: 1.5 }}>
                            Solicitante: {proc.solicitante_nome}
                            </Typography>
                            <Typography variant="body2">
                            <strong>Destino:</strong> {proc.destino}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 2 }}>
                            Solicitado em: {dayjs(proc.created_at).format('DD/MM/YYYY HH:mm')}
                            </Typography>
                        </CardContent>
                        </Card>
                    </CardActionArea>
                    </Box>
                </Grid>
                );
            })}
            </Grid>

          {loadingMore && <Box sx={{ display: 'flex', justifyContent: 'center', my: 3 }}><CircularProgress /></Box>}
          
          {!hasMore && processes.length > 0 && 
            <Typography textAlign="center" sx={{ mt: 4, color: 'text.secondary' }}>
              Você chegou ao fim da lista.
            </Typography>
          }

          {!loading && processes.length === 0 &&
            <Typography textAlign="center" sx={{ mt: 4, color: 'text.secondary' }}>
              Nenhum processo encontrado nesta visualização.
            </Typography>
          }
        </>
      )}
    </Container>
  );
};

export default Dashboard;