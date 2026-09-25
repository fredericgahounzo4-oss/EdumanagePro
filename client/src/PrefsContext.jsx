import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { translations } from "./i18n";

// Préférences d'affichage (thème, langue), mémorisées sur l'appareil.
const KEY = "smp_prefs";
const Ctx = createContext(null);

function charger() {
  try {
    const p = JSON.parse(localStorage.getItem(KEY) || "{}");
    return { theme: p.theme || "auto", langue: p.langue === "en" ? "en" : "fr" };
  } catch { return { theme: "auto", langue: "fr" }; }
}

const sombreSysteme = () => typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;

export function PrefsProvider({ children }) {
  const [prefs, setPrefs] = useState(charger);
  const [systemeSombre, setSystemeSombre] = useState(sombreSysteme);

  useEffect(() => {
    if (!window.matchMedia) return undefined;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (e) => setSystemeSombre(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const themeEffectif = prefs.theme === "auto" ? (systemeSombre ? "dark" : "light") : prefs.theme;

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", themeEffectif);
    document.documentElement.lang = prefs.langue;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", themeEffectif === "dark" ? "#091310" : "#1F3B33");
  }, [themeEffectif, prefs.langue]);

  const maj = useCallback((patch) => {
    setPrefs((p) => {
      const next = { ...p, ...patch };
      try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* quota */ }
      return next;
    });
  }, []);

  const t = useCallback((key, vars) => {
    let txt = translations[prefs.langue]?.[key] ?? translations.fr[key] ?? key;
    if (vars) for (const [k, v] of Object.entries(vars)) txt = txt.replaceAll(`{${k}}`, String(v));
    return txt;
  }, [prefs.langue]);

  const locale = prefs.langue === "en" ? "en-GB" : "fr-FR";

  const value = useMemo(() => ({
    theme: prefs.theme, themeEffectif, langue: prefs.langue, locale, t,
    setTheme: (theme) => maj({ theme }),
    basculerTheme: () => maj({ theme: themeEffectif === "dark" ? "light" : "dark" }),
    setLangue: (langue) => maj({ langue }),
  }), [prefs, themeEffectif, locale, t, maj]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePrefs() {
  return useContext(Ctx);
}
