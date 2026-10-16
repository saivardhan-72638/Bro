import axios from "axios";
import {
  API_URL,
  getToken,
  clearToken,
  notifyUnauthorized,
} from "./auth";

const api = axios.create({
  baseURL: API_URL,
});

api.interceptors.request.use((config) => {
  const token = getToken();

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      clearToken();
      notifyUnauthorized();
    }

    return Promise.reject(error);
  }
);

export default api;