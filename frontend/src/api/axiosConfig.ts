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


const REFRESH_URL = '/auth/token/refresh/';
let isRefreshing = false as boolean;
let queue: Array<(t: string) => void> = [];

function onTokenRefreshed(newToken: string) {
  queue.forEach(cb => cb(newToken));
  queue = [];
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error?.response?.status;
    const original = error?.config as any;

    // evita loop infinito
    if (status !== 401 || original?._retry) {
      return Promise.reject(error);
    }

    const refresh = localStorage.getItem('refresh');
    if (!refresh) {
      // sem refresh → limpe e mande pro login
      localStorage.removeItem('access');
      localStorage.removeItem('refresh');
      window.location.href = '/login';
      return Promise.reject(error);
    }

    original._retry = true;

    // Se já tem um refresh em andamento, enfileira a reexecução
    if (isRefreshing) {
      return new Promise(resolve => {
        queue.push((newToken: string) => {
          original.headers = original.headers || {};
          original.headers.Authorization = `Bearer ${newToken}`;
          resolve(apiClient(original));
        });
      });
    }

    try {
      isRefreshing = true;
      const { data } = await axios.post(
        `${apiClient.defaults.baseURL}${REFRESH_URL}`,
        { refresh }
      );

      const newAccess = data?.access;
      if (!newAccess) throw new Error('Sem access no refresh');

      localStorage.setItem('access', newAccess);

      onTokenRefreshed(newAccess);
      original.headers = original.headers || {};
      original.headers.Authorization = `Bearer ${newAccess}`;

      return apiClient(original);
    } catch (e) {
      // refresh falhou ⇒ sai da sessão
      localStorage.removeItem('access');
      localStorage.removeItem('refresh');
      window.location.href = '/login';
      return Promise.reject(e);
    } finally {
      isRefreshing = false;
    }
  }
);

export default apiClient;