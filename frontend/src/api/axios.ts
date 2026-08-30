import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";
import { BASE_API } from "../config/api";
import { ENDPOINTS } from "../constants/endpoints";
import { useAuthStore } from "../store/authStore";

const getLocalToken = (): string | null => {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("hrms.token");
};

const setLocalToken = (token: string | null): void => {
  if (typeof window === "undefined") return;
  if (token) {
    localStorage.setItem("hrms.token", token);
  } else {
    localStorage.removeItem("hrms.token");
  }
};

const getLocalRefreshToken = (): string | null => {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("hrms.refreshToken");
};

const setLocalRefreshToken = (token: string | null): void => {
  if (typeof window === "undefined") return;
  if (token) {
    localStorage.setItem("hrms.refreshToken", token);
  } else {
    localStorage.removeItem("hrms.refreshToken");
  }
};

const clearSession = (): void => {
  setLocalToken(null);
  setLocalRefreshToken(null);
  if (typeof window !== "undefined") {
    localStorage.removeItem("hrms.user");
  }
};

type RetryableRequest = InternalAxiosRequestConfig & { _retry?: boolean };
let refreshPromise: Promise<string> | null = null;

const axiosInstance = axios.create({
  baseURL: BASE_API,
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Request Interceptor: Attach Access Token
axiosInstance.interceptors.request.use(
  (config) => {
    const token = getLocalToken();
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// Response Interceptor: Handle Unrecoverable Auth Failure
axiosInstance.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as RetryableRequest | undefined;
    const requestUrl = originalRequest?.url || "";
    const isAuthRequest =
      requestUrl.includes(ENDPOINTS.AUTH.LOGIN) ||
      requestUrl.includes(ENDPOINTS.AUTH.REFRESH) ||
      requestUrl.includes("/auth/impersonate/exchange");

    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !isAuthRequest
    ) {
      originalRequest._retry = true;
      const refreshToken = getLocalRefreshToken();
      if (!refreshToken) {
        clearSession();
        return Promise.reject(error);
      }

      try {
        refreshPromise ??= axiosInstance
          .post(ENDPOINTS.AUTH.REFRESH, { refreshToken })
          .then((response) => {
            const { access_token, refresh_token, user } = response.data;
            setLocalToken(access_token);
            setLocalRefreshToken(refresh_token);
            // Persist fresh user (permissions, notificationPrefs) to localStorage
            // so all components always read up-to-date values without a full login.
            if (user && typeof window !== "undefined") {
              const existing = localStorage.getItem("hrms.user");
              const current = existing ? JSON.parse(existing) : {};
              const updatedUser = { ...current, ...user };
              useAuthStore.getState().setUser(updatedUser);
            }
            return access_token as string;
          })
          .finally(() => {
            refreshPromise = null;
          });

        const accessToken = await refreshPromise;
        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        }
        return axiosInstance(originalRequest);
      } catch (refreshError) {
        clearSession();
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  },
);

export default axiosInstance;
export { getLocalToken, setLocalToken };
