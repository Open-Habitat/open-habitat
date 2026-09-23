import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests",
  webServer: {
    command: "npm run build && npx vite preview --host 127.0.0.1",
    port: 4173,
    reuseExistingServer: false,
  },
  use: { baseURL: "http://127.0.0.1:4173" },
});
