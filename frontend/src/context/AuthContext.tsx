// frontend/src/context/AuthContext.tsx

import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import apiClient from '../api/axiosConfig';
import { useNavigate } from 'react-router-dom';

interface UserProfile {
  first_name: string;
  last_name: string;
  email: string;
  cpf: string | null;
  cargo: string | null;
  lotacao: string | null;
  roles: string[];
  picture?: string | null;
}

interface AuthContextType {
  isAuthenticated: boolean;
  user: UserProfile | null;
  isLoading: boolean;
  activeRole: string | null; 
  selectRole: (role: string) => void; 
  logout: () => void;
  loginWithGoogle: (code: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [token, setToken] = useState<string | null>(localStorage.getItem('access'));
  const [user, setUser] = useState<UserProfile | null>(null);
  // NOVO: Estado para o perfil ativo, inicializado do localStorage
  const [activeRole, setActiveRole] = useState<string | null>(localStorage.getItem('activeRole'));
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  // NOVO: Função para definir o perfil ativo e ir para o dashboard
  const selectRole = (role: string) => {
    setActiveRole(role);
    localStorage.setItem('activeRole', role);
    navigate('/dashboard');
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    setActiveRole(null); // Limpa o perfil ativo
    localStorage.removeItem('access');
    localStorage.removeItem('refresh');
    localStorage.removeItem('activeRole'); // Limpa do localStorage
    navigate('/login');
  };

  // Lógica de verificação e navegação foi movida para dentro do useEffect
  useEffect(() => {
    const initializeAuth = async () => {
      if (token) {
        try {
          const { data: profile } = await apiClient.get<UserProfile>('/profile/me/');
          console.debug('Profile recebido:', profile); 
          setUser(profile);

          // PRIORIDADE 1: Perfil incompleto?
          if (!profile.cpf || !profile.cargo) {
            navigate('/complete-profile');
            setIsLoading(false);
            return;
          }

          // PRIORIDADE 2: Sem perfis de acesso?
          if (!profile.roles || profile.roles.length === 0) {
            alert('Você não tem perfis de acesso atribuídos. Contate o administrador.');
            logout();
            setIsLoading(false);
            return;
          }

          // PRIORIDADE 3: Apenas um perfil?
          if (profile.roles.length === 1) {
            // Se o perfil salvo for diferente do único perfil disponível, atualiza.
            if (activeRole !== profile.roles[0]) {
              setActiveRole(profile.roles[0]);
              localStorage.setItem('activeRole', profile.roles[0]);
            }
            navigate('/dashboard'); // Vai direto para o dashboard
            setIsLoading(false);
            return;
          }

          // PRIORIDADE 4: Múltiplos perfis
          if (profile.roles.length > 1) {
            // Se já existe um perfil ativo salvo e válido, continua no dashboard
            if (activeRole && profile.roles.includes(activeRole)) {
              navigate(window.location.pathname); // Continua na página atual (ou dashboard)
            } else {
              // Se não, força a seleção
              navigate('/select-role');
            }
          }
          
        } catch (error) {
          console.error("Token inválido ou falha ao buscar perfil. Deslogando.", error);
          logout();
        }
      }
      setIsLoading(false);
    };

    initializeAuth();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]); // Re-executa se o token mudar (login/logout)


  // A função de login agora é mais simples: ela apenas obtém e salva o token.
  // O useEffect acima cuidará da navegação e verificação.
  const loginWithGoogle = async (code: string) => {
    setIsLoading(true);
    try {
      const response = await apiClient.post('/google-login/', { code });
      const accessToken = response.data?.access;
      const refreshToken = response.data?.refresh;

      if (accessToken) {
        localStorage.setItem('access', accessToken);
        if (refreshToken) {
          localStorage.setItem('refresh', refreshToken);
        }
        setToken(accessToken); // <-- Apenas atualiza o token. O useEffect fará o resto.
      } else {
        throw new Error('Token de acesso não encontrado');
      }
    } catch (err: any) {
      console.error('Erro no login com Google:', err);
      logout();
    }
  };

  const value = {
    isAuthenticated: !!token,
    user,
    isLoading,
    activeRole, // Disponibiliza o perfil ativo
    selectRole, // Disponibiliza a função de seleção
    logout,
    loginWithGoogle, // loginWithGoogle não está no value original
  };

  return (
    <AuthContext.Provider value={value}>
      {!isLoading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return context;
};