// frontend/src/pages/Login.tsx

import React from 'react';
// Importamos o hook e removemos o componente
import { useGoogleLogin, GoogleOAuthProvider } from '@react-oauth/google';
import { useAuth } from '../context/AuthContext';
import { Button } from '@mui/material'; // Usaremos um botão normal do MUI

// A variável de ambiente continua a mesma
const GOOGLE_CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID || "";

export const Login = () => {
    const { loginWithGoogle } = useAuth();

    // Aqui usamos o hook para configurar o fluxo de login
    const handleGoogleLogin = useGoogleLogin({
        // A propriedade 'flow' é usada aqui, no hook
        flow: 'auth-code',
        // A função onSuccess aqui recebe um objeto 'codeResponse' que contém o 'code'
        onSuccess: (codeResponse) => {
            loginWithGoogle(codeResponse.code);
        },
        onError: (error) => console.log('Login Failed:', error),
    });

    return (
        <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                <h1>Sistema de Diárias</h1>
                <p>Acesse com sua conta institucional.</p>
                {/* Usamos um botão normal e chamamos a função do hook no onClick.
                  Isso nos dá mais liberdade para estilizar o botão no futuro.
                */}
                <Button 
                    variant="contained" 
                    onClick={() => handleGoogleLogin()}
                >
                    Entrar com Google
                </Button>
            </div>
        </GoogleOAuthProvider>
    );
};