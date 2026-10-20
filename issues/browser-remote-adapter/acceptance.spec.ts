import { readFileSync, existsSync } from "node:fs";
import { hostOrigin } from "../test-ports.mjs";
import { expect, test } from "./worker-host";
test.use({ baseURL: hostOrigin, ignoreHTTPSErrors: true });
test("adapter captures dirty config and selected untracked spec", async ({ page }) => {
  expect(readFileSync("playwright.config.ts", "utf8")).toContain("adapter-20261020");
  expect(existsSync("../.env.hg-denied")).toBe(false);
  expect(process.platform).toBe("linux");
  expect(process.arch).toBe("arm64");
  expect(process.env.OH_BROWSER_WORKERS).toBe("2");
  expect(process.env.OH_PORT_BASE).toBe("24000");
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Tervetuloa Open Habitatiin" })).toBeVisible();
});
test("anonymous API denied under real synthetic host", async ({ request }) => {
  expect((await request.get("/api/v1/snapshot")).status()).toBe(401);
  expect((await request.get("/auth/session")).status()).toBe(401);
});
