// frontend/src/context/AuthContext.tsx

import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import apiClient from '../api/axiosConfig';
import { useNavigate } from 'react-router-dom';

// --- Interfaces para uma tipagem forte e clara ---
interface UserProfile {
  first_name: string;
  last_name: string;
  email: string;
  cpf: string | null;
  cargo: string | null;
}

interface AuthContextType {
  isAuthenticated: boolean;
  user: UserProfile | null;
  isLoading: boolean;
  loginWithGoogle: (code: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [token, setToken] = useState<string | null>(localStorage.getItem('access'));
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  const checkProfileAndNavigate = async () => {
    try {
      const { data: profile } = await apiClient.get<UserProfile>('/profile/me/');
      setUser(profile);
      
      if (!profile.cpf || !profile.cargo) {
        navigate('/complete-profile');
      } else {
        navigate('/dashboard');
      }
    } catch (error) {
      console.error("Falha ao buscar perfil do usuário. Deslogando.", error);
      logout();
    }
  };

  useEffect(() => {
    const initializeAuth = async () => {
      // Usamos o token salvo para tentar revalidar a sessão do usuário
      if (token) {
        await checkProfileAndNavigate();
      }
      setIsLoading(false);
    };
    initializeAuth();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loginWithGoogle = async (code: string) => {
    setIsLoading(true);
    try {
      // CORRIGIDO: Usando a URL que você confirmou que funciona!
      const response = await apiClient.post('/google-login/', {
        code
      });

      // CORRIGIDO: Usando os nomes de token que sua API retorna!
      const accessToken = response.data?.access;
      const refreshToken = response.data?.refresh;

      if (accessToken) { // Verificamos apenas o access token como principal
        localStorage.setItem('access', accessToken);
        if (refreshToken) {
            localStorage.setItem('refresh', refreshToken);
        }
        setToken(accessToken);
        
        // MUDANÇA PRINCIPAL: Chamamos a função de verificação de perfil
        await checkProfileAndNavigate();

      } else {
        console.warn('Token de acesso não encontrado na resposta do backend:', response.data);
        throw new Error('Token de acesso não encontrado');
      }
    } catch (err: any) {
      if (err?.response) {
        console.error('Erro no login com Google - resposta do servidor:', err.response.status, err.response.data);
      } else {
        console.error('Erro no login com Google:', err);
      }
      logout();
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    // CORRIGIDO: Remove as chaves corretas do localStorage
    localStorage.removeItem('access');
    localStorage.removeItem('refresh');
    navigate('/login');
  };

  const value = {
    isAuthenticated: !!token,
    user,
    isLoading,
    loginWithGoogle,
    logout,
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