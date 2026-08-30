import React, { createContext, useContext, useEffect, useState, useCallback, useLayoutEffect } from "react";

export type Theme = "light" | "dark";

export interface ThemeContextType {
  theme: Theme;
  isDark: boolean;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

import { OWNER_STORAGE_KEYS } from "../config/storage";

const STORAGE_KEY = OWNER_STORAGE_KEYS.THEME;

function getInitialTheme(): Theme {
  if (typeof window === "undefined") return "light";
  try {
    const item = localStorage.getItem(STORAGE_KEY);
    if (item === "false" || item === '"false"') return "light";
    if (item === "true" || item === '"true"') return "dark";
    if (item === "light" || item === '"light"') return "light";
    if (item === "dark" || item === '"dark"') return "dark";
  } catch (e) {
    console.error("Error reading theme from localStorage", e);
  }
  return "light"; // Default to light mode
}

function applyThemeToDOM(theme: Theme) {
  if (typeof document !== "undefined") {
    const isDark = theme === "dark";
    document.documentElement.classList.toggle("dark", isDark);
  }
}

// Synchronously apply theme class on module load / initial execution if window exists
if (typeof window !== "undefined") {
  const initial = getInitialTheme();
  applyThemeToDOM(initial);
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<Theme>(() => {
    const initial = getInitialTheme();
    applyThemeToDOM(initial);
    return initial;
  });

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
    applyThemeToDOM(newTheme);
    try {
      localStorage.setItem(STORAGE_KEY, newTheme === "dark" ? "true" : "false");
    } catch (e) {
      console.error("Error saving theme to localStorage", e);
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [theme, setTheme]);

  // Synchronize DOM on layout effect to prevent flash
  const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;
  useIsomorphicLayoutEffect(() => {
    applyThemeToDOM(theme);
  }, [theme]);

  // Cross-tab synchronization via window "storage" event listener
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        const updatedTheme = getInitialTheme();
        setThemeState(updatedTheme);
        applyThemeToDOM(updatedTheme);
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  const isDark = theme === "dark";

  return (
    <ThemeContext.Provider value={{ theme, isDark, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
};
