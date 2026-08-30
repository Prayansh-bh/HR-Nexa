export const API_VERSION = "";

export const BASE_API =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL) ||
  "http://localhost:3001/api";

export const TENANT_APP_URL =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_TENANT_APP_URL) ||
  "http://localhost:5173";

export const PORTAL_TYPE =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_PORTAL_TYPE) ||
  "OWNER";
