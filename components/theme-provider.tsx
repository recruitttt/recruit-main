"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type RecruitTheme = "light" | "dark";

export const RECRUIT_THEME_STORAGE_KEY = "recruit-theme";

type ThemeContextValue = {
  theme: RecruitTheme;
  setTheme: (theme: RecruitTheme) => void;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<RecruitTheme>("light");

  const setTheme = useCallback((nextTheme: RecruitTheme) => {
    setThemeState(nextTheme);
    applyTheme(nextTheme);
    try {
      window.localStorage.setItem(RECRUIT_THEME_STORAGE_KEY, nextTheme);
    } catch {
      // Ignore storage failures; the DOM theme still changes for this session.
    }
  }, []);

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      const initialTheme = readBrowserTheme();
      setThemeState(initialTheme);
      applyTheme(initialTheme);
    });
    return () => cancelAnimationFrame(id);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [setTheme, theme]);

  const value = useMemo(
    () => ({ theme, setTheme, toggleTheme }),
    [setTheme, theme, toggleTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}

function readBrowserTheme(): RecruitTheme {
  const current = document.documentElement.dataset.theme;
  if (current === "dark" || current === "light") return current;

  try {
    const stored = window.localStorage.getItem(RECRUIT_THEME_STORAGE_KEY);
    if (stored === "dark" || stored === "light") return stored;
  } catch {
    // Fall through to system preference.
  }

  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(theme: RecruitTheme) {
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.classList.toggle("dark", theme === "dark");
  root.style.colorScheme = theme;
}
