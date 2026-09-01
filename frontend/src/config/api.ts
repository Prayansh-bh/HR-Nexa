export const API_VERSION = "";

export const BASE_API =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL) ||
  "https://api.hrnexa.com/api";

export const OWNER_APP_URL =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_OWNER_APP_URL) ||
  "https://owner.hrnexa.com";

export const PORTAL_TYPE =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_PORTAL_TYPE) ||
  "TENANT";

