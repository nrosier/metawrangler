/**
 * Locale context and provider — manages current language selection
 * Persists to localStorage for user preference
 */
import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import type { Locale } from "./messages";
import { messages } from "./messages";

interface LocaleContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: keyof (typeof messages)["en"], ...args: unknown[]) => string;
}

const LocaleContext = createContext<LocaleContextType | undefined>(undefined);

const LOCALE_STORAGE_KEY = "metawrangler-locale";
const DEFAULT_LOCALE: Locale = "en";

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);
  const [mounted, setMounted] = useState(false);

  // Initialize from localStorage on mount (use derived state pattern)
  const [prevMounted, setPrevMounted] = useState(false);
  if (!prevMounted) {
    setPrevMounted(true);
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (stored === "en" || stored === "es") {
      setLocaleState(stored);
    }
    setMounted(true);
  }

  // Update localStorage and document lang when locale changes
  useEffect(() => {
    if (!mounted) return;
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    document.documentElement.lang = locale;
  }, [locale, mounted]);

  function setLocale(newLocale: Locale) {
    setLocaleState(newLocale);
  }

  function t(key: keyof (typeof messages)["en"], ...args: unknown[]): string {
    const catalog = messages[locale];
    const message = catalog[key];

    if (!message) {
      console.warn(`Missing translation key: ${String(key)}`);
      return String(key);
    }

    // If it's a function, call it with arguments (for pluralization, interpolation)
    if (typeof message === "function") {
      return (message as (...args: unknown[]) => string)(...args);
    }

    return String(message);
  }

  return (
    <LocaleContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale(): LocaleContextType {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    throw new Error("useLocale must be used within <LocaleProvider>");
  }
  return ctx;
}
