import axios from "axios";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000/api/v1",
  timeout: 15_000,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem("sgtb_access_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config as typeof error.config & { _retried?: boolean };
    const refresh = sessionStorage.getItem("sgtb_refresh_token");
    if (error.response?.status === 401 && refresh && !original?._retried) {
      original._retried = true;
      try {
        const { data } = await axios.post<{ access: string; refresh?: string }>(
          `${api.defaults.baseURL}/auth/refresh/`,
          { refresh },
        );
        sessionStorage.setItem("sgtb_access_token", data.access);
        if (data.refresh) sessionStorage.setItem("sgtb_refresh_token", data.refresh);
        original.headers.Authorization = `Bearer ${data.access}`;
        return api(original);
      } catch {
        sessionStorage.clear();
        window.location.assign("/login");
      }
    }
    return Promise.reject(error);
  },
);
