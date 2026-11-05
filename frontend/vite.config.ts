import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const proxy = { "/api": { target: "http://localhost:8000", changeOrigin: true } };

export default defineConfig({
  plugins: [react()],
  // Saat development, /api diteruskan ke backend FastAPI.
  server: { port: 5173, proxy },
  preview: { port: 4173, proxy },
});
