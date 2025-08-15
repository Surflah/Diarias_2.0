// frontend/src/api/axiosConfig.ts

import axios from 'axios';

const apiClient = axios.create({
  baseURL: 'http://127.0.0.1:8000/api', 
  headers: {
    'Content-Type': 'application/json'
  }
});

apiClient.interceptors.request.use(
  (config) => {
    // Pega o token de acesso do localStorage.
    const token = localStorage.getItem('access');
    
    // Se o token existir, anexa ao cabeçalho de autorização.
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // Retorna a configuração modificada para que a requisição continue.
    return config;
  },
  (error) => {
    // Faz alguma coisa com o erro da requisição
    return Promise.reject(error);
  }
);

export default apiClient;