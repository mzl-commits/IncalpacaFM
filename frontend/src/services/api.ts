import axios from "axios";

type RefreshResponse = { access: string; refresh?: string };

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8008/api/v1",
  timeout: 15_000,
});

let refreshRequest: Promise<string> | null = null;

function refreshAccessToken(refreshToken: string) {
  if (!refreshRequest) {
    refreshRequest = axios
      .post<RefreshResponse>(`${api.defaults.baseURL}/auth/refresh/`, {
        refresh: refreshToken,
      })
      .then(({ data }) => {
        sessionStorage.setItem("sgtb_access_token", data.access);
        if (data.refresh) sessionStorage.setItem("sgtb_refresh_token", data.refresh);
        return data.access;
      })
      .finally(() => {
        refreshRequest = null;
      });
  }
  return refreshRequest;
}

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
        const currentAccess = sessionStorage.getItem("sgtb_access_token");
        const failedAuthorization = original.headers?.Authorization;
        const access =
          currentAccess && failedAuthorization !== `Bearer ${currentAccess}`
            ? currentAccess
            : await refreshAccessToken(refresh);
        original.headers.Authorization = `Bearer ${access}`;
        return api(original);
      } catch {
        sessionStorage.removeItem("sgtb_access_token");
        sessionStorage.removeItem("sgtb_refresh_token");
        sessionStorage.removeItem("sgtb_current_user");
        if (window.location.pathname !== "/login") window.location.assign("/login");
      }
    }
    return Promise.reject(error);
  },
);
