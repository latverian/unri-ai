import { usePrefs } from "./prefs";

/** Tombol tema cepat (terang/gelap). Pilihan lengkap ada di halaman Pengaturan. */
export function useTheme() {
  const { resolvedTheme, toggleTheme } = usePrefs();
  return { theme: resolvedTheme, toggle: toggleTheme };
}
