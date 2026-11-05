import type { Config } from "tailwindcss";

// Warna mengikuti token CSS di src/styles/tokens.css (otomatis berganti saat mode gelap).
const v = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: ["selector", '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        bg: v("bg"),
        surface: v("surface"),
        surface2: v("surface-2"),
        primary: { DEFAULT: v("primary"), strong: v("primary-strong"), hover: v("primary-hover"), soft: v("primary-soft") },
        onprimary: v("on-primary"),
        emas: { DEFAULT: v("emas"), teks: v("emas-teks"), soft: v("emas-soft") },
        teks: { DEFAULT: v("teks"), 2: v("teks-2") },
        garis: v("garis"),
        error: { DEFAULT: v("error"), soft: v("error-soft") },
      },
      fontFamily: {
        serif: ['"Noto Serif"', "Georgia", "serif"],
        sans: ['"Plus Jakarta Sans"', "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono"', "ui-monospace", "monospace"],
      },
      borderRadius: { sm: "8px", DEFAULT: "14px", lg: "20px" },
      boxShadow: { card: "0 1px 2px rgb(7 59 38 / .06), 0 4px 16px rgb(7 59 38 / .06)" },
      maxWidth: { chat: "760px", prose: "72ch" },
      keyframes: {
        rise: { from: { opacity: "0", transform: "translateY(8px)" }, to: { opacity: "1", transform: "none" } },
        pulseGem: { "0%,100%": { opacity: ".3", transform: "scale(.8)" }, "50%": { opacity: "1", transform: "scale(1)" } },
      },
      animation: { rise: "rise .22s cubic-bezier(.2,.8,.2,1)", gem: "pulseGem 1.2s ease-in-out infinite" },
    },
  },
  plugins: [],
} satisfies Config;
