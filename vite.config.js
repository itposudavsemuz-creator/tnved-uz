import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // BASE_URL устанавливается через env в GitHub Actions
  // Локально — "/"
  base: process.env.VITE_BASE_URL || "/",
  build: {
    outDir: "dist",
    // Копируем папку public/data в dist/data при сборке
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ["react", "react-dom"],
          search: ["minisearch"],
        },
      },
    },
  },
  // Чтобы Vite отдавал файлы из public/data в dev-режиме
  publicDir: "public",
});
