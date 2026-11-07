import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
export default defineConfig(({ command }) => {
  if (command === "build" && process.env.VITE_SYNTHETIC_DEMO === "true")
    throw new Error("Synthetic demo cannot be built as a production package");
  return {
    plugins: [react()],
    // Do not embed dev-only rehearsal source in production source maps.
    build: { sourcemap: false },
    server: {
      host: "127.0.0.1",
      fs: {
        // Shared design assets and the shipped start-page instruction are public build inputs.
        allow: [
          fileURLToPath(new URL(".", import.meta.url)),
          fileURLToPath(new URL("../design-system", import.meta.url)),
          fileURLToPath(
            new URL("../internal/daemon/start-page-skill", import.meta.url),
          ),
        ],
      },
    },
    preview: { host: "127.0.0.1" },
    test: {
      environment: "jsdom",
      globals: true,
      maxWorkers: Number(process.env.OH_WEB_WORKERS ?? 8),
      include: [
        "src/**/*.test.tsx",
        "src/**/*.test.ts",
        "scripts/**/*.test.mjs",
      ],
      setupFiles: ["src/test/setupLanguage.ts"],
    },
  };
});
