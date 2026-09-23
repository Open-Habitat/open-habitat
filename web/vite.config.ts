import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
export default defineConfig({
  plugins: [react()],
  build: { sourcemap: true },
  server: { host: "127.0.0.1" },
  preview: { host: "127.0.0.1" },
  test: { environment: "jsdom", globals: true, include: ["src/**/*.test.tsx"] },
});
