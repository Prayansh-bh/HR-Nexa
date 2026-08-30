import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";
import { BASE_API } from "../config/api";
import { OWNER_STORAGE_KEYS } from "../config/storage";

const getLocalToken = (): string | null => {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(OWNER_STORAGE_KEYS.TOKEN);
};

const setLocalToken = (token: string | null): void => {
  if (typeof window === "undefined") return;
  if (token) {
    localStorage.setItem(OWNER_STORAGE_KEYS.TOKEN, token);
  } else {
    localStorage.removeItem(OWNER_STORAGE_KEYS.TOKEN);
  }
};

const getLocalRefreshToken = (): string | null => {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(OWNER_STORAGE_KEYS.REFRESH_TOKEN);
};

const setLocalRefreshToken = (token: string | null): void => {
  if (typeof window === "undefined") return;
  if (token) {
    localStorage.setItem(OWNER_STORAGE_KEYS.REFRESH_TOKEN, token);
  } else {
    localStorage.removeItem(OWNER_STORAGE_KEYS.REFRESH_TOKEN);
  }
};

export const clearOwnerSession = (): void => {
  setLocalToken(null);
  setLocalRefreshToken(null);
  if (typeof window !== "undefined") {
    localStorage.removeItem(OWNER_STORAGE_KEYS.USER);
  }
};

type RetryableRequest = InternalAxiosRequestConfig & { _retry?: boolean };
let refreshPromise: Promise<string> | null = null;

export const ownerAxios = axios.create({
  baseURL: BASE_API,
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Request Interceptor: Attach Owner Access Token
ownerAxios.interceptors.request.use(
  (config) => {
    const token = getLocalToken();
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// Response Interceptor: Handle 401 & Token Refresh for Owner
ownerAxios.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as RetryableRequest | undefined;
    const requestUrl = originalRequest?.url || "";
    const isAuthRequest =
      requestUrl.includes("/auth/login") || requestUrl.includes("/auth/refresh");

    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !isAuthRequest
    ) {
      originalRequest._retry = true;
      const refreshToken = getLocalRefreshToken();
      if (!refreshToken) {
        clearOwnerSession();
        return Promise.reject(error);
      }

      try {
        refreshPromise ??= ownerAxios
          .post("/auth/refresh", { refreshToken })
          .then((response) => {
            const { access_token, refresh_token, user } = response.data;
            setLocalToken(access_token);
            setLocalRefreshToken(refresh_token);
            if (user && typeof window !== "undefined") {
              localStorage.setItem(OWNER_STORAGE_KEYS.USER, JSON.stringify(user));
            }
            return access_token;
          })
          .catch((refreshErr) => {
            clearOwnerSession();
            throw refreshErr;
          })
          .finally(() => {
            refreshPromise = null;
          });

        const newAccessToken = await refreshPromise;
        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        }
        return ownerAxios(originalRequest);
      } catch (refreshErr) {
        clearOwnerSession();
        return Promise.reject(refreshErr);
      }
    }

    return Promise.reject(error);
  },
);

export default ownerAxios;
