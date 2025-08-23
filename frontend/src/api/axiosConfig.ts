// frontend/src/api/axiosConfig.ts

import axios from 'axios';

const apiClient = axios.create({
  baseURL: 'http://127.0.0.1:8000/api', 
});

apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access');
    if (token) {
      // axios typings aceitam string|number|boolean
      (config.headers as any).Authorization = `Bearer ${token}`;
    }

    // Se for FormData, deixe o browser setar o boundary
    if (config.data instanceof FormData) {
      if (config.headers && 'Content-Type' in config.headers) {
        delete (config.headers as any)['Content-Type'];
      }
    } else {
      // Requisições normais em JSON
      (config.headers as any)['Content-Type'] = 'application/json';
    }

    return config;
  },
  (error) => Promise.reject(error)
);

export default apiClient;