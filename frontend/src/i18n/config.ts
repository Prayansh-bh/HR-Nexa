import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { en } from "./locales/en";
import { hi } from "./locales/hi";

export const SUPPORTED_LANGUAGES = ["en", "hi"] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const resources = {
  en: { translation: en },
  hi: { translation: hi },
} as const;

export function resolveLanguage(lang?: string | null): SupportedLanguage {
  if (!lang) return "en";
  const clean = lang.trim().toLowerCase();
  if (clean === "hi" || clean === "hindi") {
    return "hi";
  }
  return "en";
}

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: "en",
    fallbackLng: "en",
    defaultNS: "translation",
    ns: ["translation"],
    interpolation: {
      escapeValue: false, // React already escapes values
    },
    react: {
      useSuspense: false,
    },
  });

export default i18n;
