/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // Сайт на GitHub Pages открывается из подпапки (/CRM-demo/): путь передаёт workflow деплоя.
  // Локально и на хостингах с собственным доменом — корень.
  base: process.env.BASE_PATH ?? "/",
  plugins: [react()],
  server: { port: 5173 },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: ["src/test/setup.ts"],
  },
});
