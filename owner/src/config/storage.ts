/**
 * Dedicated Storage Namespace for Platform Owner Portal
 *
 * Strictly isolated from tenant application (hrms.* / hrnexa.tenant.*)
 */
export const OWNER_STORAGE_KEYS = {
  TOKEN: "hrnexa.owner.token",
  REFRESH_TOKEN: "hrnexa.owner.refreshToken",
  USER: "hrnexa.owner.user",
  SIDEBAR: "hrnexa.owner.sidebar",
  THEME: "hrnexa.owner.theme",
  COMPANY: "hrnexa.owner.company",
} as const;
