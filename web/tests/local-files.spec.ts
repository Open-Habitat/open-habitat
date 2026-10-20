import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { hostOrigin } from "../test-ports.mjs";
import { expect, test as hostTest, type Page } from "./worker-host";

// Persisted native handles crash the pinned Chromium's off-the-record context
// (also reproduced on an application-free page). Exercise normal-profile
// permission persistence instead, with a fresh synthetic profile per case.
const test = hostTest.extend({
  context: async ({ playwright }, use) => {
    const profile = await mkdtemp(join(tmpdir(), "oh-folder-profile-"));
    try {
      const context = await playwright.chromium.launchPersistentContext(
        profile,
        {
          channel: "chromium",
          headless: true,
          ignoreHTTPSErrors: true,
          baseURL: hostOrigin,
          viewport: { width: 1280, height: 900 },
        },
      );
      try {
        await use(context);
      } finally {
        await context.close();
      }
    } finally {
      await rm(profile, { recursive: true, force: true });
    }
  },
});

async function savedGrantCount(page: Page) {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("open-habitat-local-folder", 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      return await new Promise<number>((resolve, reject) => {
        const request = db.transaction("grants").objectStore("grants").count();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    } finally {
      db.close();
    }
  });
}
async function signIn(page: import("@playwright/test").Page) {
  await page.request.get("/fixture/scenario?value=ready");
  await page.goto("/workspaces");
  await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
  await page.getByRole("link", { name: "Alice", exact: true }).click();
}

test("folder grant is explicit and can be stopped; local replies require CSRF @a11y", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "showDirectoryPicker", {
      configurable: true,
      value: async () => {
        const root = await navigator.storage.getDirectory();
        return root.getDirectoryHandle("Synthetic Downloads", { create: true });
      },
    });
  });
  await signIn(page);
  const folder = page.getByRole("region", { name: "Oman koneen kansio" });
  await folder
    .getByRole("button", { name: "Salli oman koneen kansio" })
    .click();
  await expect(
    folder.getByRole("button", { name: /Synthetic Downloads/ }),
  ).toBeVisible();
  const session = await (await page.request.get("/auth/session")).json();
  // Wait for the asynchronous native-handle transaction, not just its
  // optimistic presentation, before destroying the page that owns it.
  await expect.poll(() => savedGrantCount(page)).toBe(1);
  await page.reload();
  await expect(
    folder.getByRole("button", { name: /Synthetic Downloads/ }),
  ).toBeVisible({ timeout: 15000 });
  const restoredSession = await page.request.get("/auth/session");
  expect(restoredSession.status()).toBe(200);
  expect(await restoredSession.json()).toMatchObject({
    web_identity_id: session.web_identity_id,
    csrf: session.csrf,
  });
  expect(
    (
      await page.request.post("/api/v1/local-files", {
        data: { id: "11111111-1111-4111-8111-111111111111" },
      })
    ).status(),
  ).toBe(403);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await folder
    .getByRole("button", { name: "Lopeta kansion jakaminen" })
    .click();
  await expect(
    folder.getByRole("button", { name: "Salli oman koneen kansio" }),
  ).toBeVisible();
  await expect.poll(() => savedGrantCount(page)).toBe(0);
  await page.reload();
  await expect(
    folder.getByRole("button", { name: "Salli oman koneen kansio" }),
  ).toBeVisible();
});

test("unsupported browsers explain manual attachments instead of offering a grant", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "showDirectoryPicker", {
      value: undefined,
      configurable: true,
    });
  });
  await signIn(page);
  const folder = page.getByRole("region", { name: "Oman koneen kansio" });
  await expect(folder).toContainText("ei ole käytettävissä tässä selaimessa");
  await expect(folder.getByRole("button")).toHaveCount(0);
});
