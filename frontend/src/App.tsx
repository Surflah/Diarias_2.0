// src/App.tsx
import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Login } from './pages/Login';
import { useAuth } from './context/AuthContext';
import { CompleteProfile } from './pages/CompleteProfile';
import { SelectRole } from './pages/SelectRole'; 
import { AppLayout } from './components/Layout';
import { NovaDiaria } from './pages/NovaDiaria';

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

      {/* 2. Envolvemos todas as rotas privadas em uma rota "mãe" com o AppLayout */}
      <Route
        path="/*"
        element={
          <PrivateRoute>
            <AppLayout>
              <Routes>
                <Route path="/complete-profile" element={<CompleteProfile />} />
                <Route path="/select-role" element={<SelectRole />} />
                <Route
                  path="/dashboard"
                  element={
                    <div>
                      <h1>Dashboard</h1>
                      <p>Você está logado com o perfil: <strong>{useAuth().activeRole}</strong></p>
                    </div>
                  }
                />
                <Route path="/diarias/nova" element={<NovaDiaria />} />
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </Routes>
            </AppLayout>
          </PrivateRoute>
        }
      />
    </Routes>
  );
}

export default App;