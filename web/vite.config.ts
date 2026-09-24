import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
export default defineConfig({
  plugins: [react()],
  build: { sourcemap: true },
  server: {
    host: "127.0.0.1",
    fs: {
      // Only the shared design tokens and bundled fonts live outside web/.
      allow: [
        fileURLToPath(new URL(".", import.meta.url)),
        fileURLToPath(new URL("../design-system", import.meta.url)),
      ],
    },
  },
  preview: { host: "127.0.0.1" },
  test: { environment: "jsdom", globals: true, include: ["src/**/*.test.tsx"] },
});
