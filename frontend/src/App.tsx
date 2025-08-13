// src/App.tsx
import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Login } from './pages/Login';
import { useAuth } from './context/AuthContext';

// Aceita qualquer nó React e evita depender do namespace JSX
const PrivateRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, isLoading } = useAuth(); // espera que seu AuthContext exporte isLoading opcionalmente

  // Se estiver carregando (por exemplo, checando token), mostra um loading simples
  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <span>Carregando...</span>
      </div>
    );
  }

  return isAuthenticated ? (children as React.ReactElement) : <Navigate to="/login" replace />;
};

function App(): React.ReactElement {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route
        path="/dashboard"
        element={
          <PrivateRoute>
            <div>
              <h1>Dashboard - Bem-vindo!</h1>
              <p>Login realizado com sucesso.</p>
            </div>
          </PrivateRoute>
        }
      />

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default App;
