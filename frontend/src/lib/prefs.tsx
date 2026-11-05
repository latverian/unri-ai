import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

export type ThemePref = "light" | "dark" | "system";
export type TextSize = "normal" | "sedang" | "besar";
export type Prefs = { theme: ThemePref; textSize: TextSize; ornamen: boolean; pantun: boolean };

const KEY = "unri-prefs";
const DEFAULTS: Prefs = { theme: "system", textSize: "normal", ornamen: true, pantun: true };
export const TEXT_SIZES: Record<TextSize, { px: number; label: string }> = {
  normal: { px: 16, label: "Normal" },
  sedang: { px: 18, label: "Sedang" },
  besar: { px: 20, label: "Besar" },
};

function load(): Prefs {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? "null");
    if (saved && typeof saved === "object") return { ...DEFAULTS, ...saved };
    const legacy = localStorage.getItem("unri-theme"); // versi lama hanya menyimpan tema
    if (legacy === "light" || legacy === "dark") return { ...DEFAULTS, theme: legacy };
  } catch { /* abaikan */ }
  return DEFAULTS;
}

const systemDark = () => typeof matchMedia !== "undefined" && matchMedia("(prefers-color-scheme: dark)").matches;

type Ctx = { prefs: Prefs; set: (patch: Partial<Prefs>) => void; resolvedTheme: "light" | "dark"; toggleTheme: () => void };
const PrefsCtx = createContext<Ctx | null>(null);

export function PrefsProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<Prefs>(load);
  const [sysDark, setSysDark] = useState(systemDark);

  useEffect(() => {
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const on = () => setSysDark(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  const resolvedTheme = prefs.theme === "system" ? (sysDark ? "dark" : "light") : prefs.theme;

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = resolvedTheme;
    root.style.setProperty("--answer-size", `${TEXT_SIZES[prefs.textSize].px}px`);
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", resolvedTheme === "dark" ? "#0E1712" : "#0B5D3B");
    try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch { /* abaikan */ }
  }, [prefs, resolvedTheme]);

  const set = useCallback((patch: Partial<Prefs>) => setPrefs((p) => ({ ...p, ...patch })), []);
  const toggleTheme = useCallback(() => set({ theme: resolvedTheme === "dark" ? "light" : "dark" }), [resolvedTheme, set]);

  return <PrefsCtx.Provider value={{ prefs, set, resolvedTheme, toggleTheme }}>{children}</PrefsCtx.Provider>;
}

export function usePrefs() {
  const ctx = useContext(PrefsCtx);
  if (!ctx) throw new Error("usePrefs harus dipakai di dalam PrefsProvider");
  return ctx;
}
