import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  systemSettingsService,
  GlobalSettings,
  RuntimeSettings,
} from "../services/system-settings.service";
import i18n, { resolveLanguage } from "../i18n";

export const SYSTEM_SETTINGS_QUERY_KEY = ["system", "settings"] as const;
export const SYSTEM_RUNTIME_SETTINGS_QUERY_KEY = ["system", "runtime-settings"] as const;

/**
 * SuperAdmin-only query for the full platform configuration (10 settings).
 */
export function useSystemSettingsQuery() {
  const query = useQuery<GlobalSettings>({
    queryKey: SYSTEM_SETTINGS_QUERY_KEY,
    queryFn: () => systemSettingsService.getSettings(),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  useEffect(() => {
    if (query.data?.defaultLanguage) {
      const canonical = resolveLanguage(query.data.defaultLanguage);
      if (i18n.language !== canonical) {
        void i18n.changeLanguage(canonical);
      }
    }
  }, [query.data?.defaultLanguage]);

  return query;
}

/**
 * Safe runtime configuration query for all authenticated users (Timezone, Currency, DateFormat, Language).
 */
export function useSystemRuntimeSettingsQuery() {
  const query = useQuery<RuntimeSettings>({
    queryKey: SYSTEM_RUNTIME_SETTINGS_QUERY_KEY,
    queryFn: () => systemSettingsService.getRuntimeSettings(),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  useEffect(() => {
    if (query.data?.defaultLanguage) {
      const canonical = resolveLanguage(query.data.defaultLanguage);
      if (i18n.language !== canonical) {
        void i18n.changeLanguage(canonical);
      }
    }
  }, [query.data?.defaultLanguage]);

  return query;
}

