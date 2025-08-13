// frontend/src/context/AuthContext.tsx
import React, { createContext, useState, useContext, ReactNode } from 'react';
import apiClient from '../api/axiosConfig';
import { useNavigate } from 'react-router-dom';

// 1. Adicionamos isLoading ao tipo
interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean; // Adicionado
  loginWithGoogle: (code: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [token, setToken] = useState<string | null>(localStorage.getItem('authToken'));
  const [isLoading, setIsLoading] = useState(false); // 2. Adicionamos o estado
  const navigate = useNavigate();

  const loginWithGoogle = async (code: string) => {
    setIsLoading(true); // 3. Ativamos o loading
    try {
      const response = await apiClient.post('/auth/google/', { code });
      const apiToken = response.data.key;
      setToken(apiToken);
      localStorage.setItem('authToken', apiToken);
      navigate('/dashboard');
    } catch (error) {
      console.error("Erro no login com Google:", error);
      logout();
    } finally {
      setIsLoading(false); // 4. Desativamos o loading no final
    }
  };

  const logout = () => {
    setToken(null);
    localStorage.removeItem('authToken');
    navigate('/login');
  };

  // 5. Passamos o isLoading para o value do contexto
  const value = {
    isAuthenticated: !!token,
    isLoading,
    loginWithGoogle,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
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