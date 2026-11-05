import { useEffect, useState } from "react";

export type Theme = "light" | "dark";
const KEY = "unri-theme";

function current(): Theme {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(current);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "dark" ? "#0E1712" : "#0B5D3B");
  }, [theme]);
  const toggle = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    try { localStorage.setItem(KEY, next); } catch { /* abaikan */ }
    setTheme(next);
  };
  return { theme, toggle };
}
