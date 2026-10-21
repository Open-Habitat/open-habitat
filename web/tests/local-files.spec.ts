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
  await page
    .getByRole("button")
    .and(page.getByTestId("github-sign-in"))
    .click();
  await page.getByRole("link").nth(0).click();
  await page.goto("/settings/integraatiot");
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
  const folder = page.getByRole("region").and(page.getByTestId("local-folder"));
  await expect(folder.getByTestId("local-folder-unavailable")).toHaveCount(0);
  await folder
    .getByRole("button")
    .and(folder.getByTestId("local-folder-share"))
    .click();
  await expect(
    folder.getByRole("button").and(folder.getByTestId("local-folder-open")),
  ).toBeVisible();
  await expect(folder).toContainText("Synthetic Downloads");
  const session = await (await page.request.get("/auth/session")).json();
  // Wait for the asynchronous native-handle transaction, not just its
  // optimistic presentation, before destroying the page that owns it.
  await expect.poll(() => savedGrantCount(page)).toBe(1);
  await page.reload();
  await expect(
    folder.getByRole("button").and(folder.getByTestId("local-folder-open")),
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
    .getByRole("button")
    .and(folder.getByTestId("local-folder-unshare"))
    .click();
  await expect(
    folder.getByRole("button").and(folder.getByTestId("local-folder-share")),
  ).toBeVisible();
  await expect.poll(() => savedGrantCount(page)).toBe(0);
  await page.reload();
  await expect(
    folder.getByRole("button").and(folder.getByTestId("local-folder-share")),
  ).toBeVisible();
});

test("missing picker API shows guidance instead of offering a grant @a11y", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "showDirectoryPicker", {
      value: undefined,
      configurable: true,
    });
  });
  await signIn(page);
  const folder = page.getByRole("region").and(page.getByTestId("local-folder"));
  await expect(folder).toBeVisible();
  await expect(folder.getByTestId("local-folder-unavailable")).toBeVisible();
  await expect(folder.getByRole("button")).toHaveCount(0);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

for (const failure of ["AbortError", "SecurityError"]) {
  test(`picker ${failure} offers recovery without granting access @a11y`, async ({
    page,
  }) => {
    await page.addInitScript((name) => {
      let attempts = 0;
      Object.defineProperty(window, "showDirectoryPicker", {
        configurable: true,
        value: async () => {
          if (++attempts === 1)
            throw new DOMException("synthetic refusal", name);
          const root = await navigator.storage.getDirectory();
          return root.getDirectoryHandle("Screenshots", { create: true });
        },
      });
    }, failure);
    await signIn(page);
    const folder = page
      .getByRole("region")
      .and(page.getByTestId("local-folder"));
    const share = folder
      .getByRole("button")
      .and(folder.getByTestId("local-folder-share"));
    await expect(folder.getByTestId("local-folder-guidance")).toBeVisible();
    await share.click();
    await expect(
      folder
        .getByRole("status")
        .and(folder.getByTestId("local-folder-picker-issue")),
    ).toBeVisible();
    await expect(share).toBeEnabled();
    await expect(folder.getByTestId("local-folder-open")).toHaveCount(0);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await share.click();
    await expect(folder.getByTestId("local-folder-open")).toBeVisible();
    await expect(folder.getByTestId("local-folder-picker-issue")).toHaveCount(
      0,
    );
    await expect.poll(() => savedGrantCount(page)).toBe(1);
  });
}

test("a running conversation can list and fetch a folder granted after its first turn", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "showDirectoryPicker", {
      configurable: true,
      value: async () => {
        const root = await navigator.storage.getDirectory();
        const folder = await root.getDirectoryHandle("Late grant", {
          create: true,
        });
        const file = await folder.getFileHandle("late-grant.txt", {
          create: true,
        });
        const writer = await file.createWritable();
        await writer.write("synthetic late-granted file contents");
        await writer.close();
        return folder;
      },
    });
  });
  await signIn(page);
  await page
    .getByRole("navigation")
    .getByTestId("workspace-start-ordinary-dir")
    .click();
  const input = page.getByTestId("message-input");
  await input.fill("first turn before sharing");
  await input.press("Enter");
  await expect(page.getByTestId("history-stage-toggle").last()).toBeVisible({
    timeout: 20000,
  });
  const conversationURL = page.url();
  await page.getByTestId("attach-file").click();
  await page.getByTestId("attachment-folder").click();
  await page.getByTestId("local-folder-share").click();
  await expect(page.getByTestId("local-folder-open")).toBeVisible();
  await page.keyboard.press("Escape");
  await input.fill("local folder probe");
  await input.press("Enter");
  await expect(page.getByTestId("agent-turn")).toHaveCount(2);
  const turn = page.getByTestId("agent-turn").last();
  await expect(turn.getByTestId("history-stage-toggle")).toBeVisible({
    timeout: 40000,
  });
  await turn.getByTestId("history-stage-toggle").click();
  const tool = turn.getByTestId("history-tool-toggle").first();
  if ((await tool.getAttribute("aria-expanded")) !== "true") await tool.click();
  // Assert native tool data, not UI wording. The bytes must have crossed the
  // browser grant, upload, controller socket and release-provided JS tool.
  await expect(turn).toContainText("late-grant.txt");
  const attachment = (await turn.innerText()).match(
    /attachments\/([0-9a-f-]{36})/,
  );
  expect(attachment).not.toBeNull();
  const downloaded = await page.request.get(
    `/api/v1/attachments/${attachment?.[1]}`,
  );
  expect(downloaded.status()).toBe(200);
  expect(await downloaded.text()).toBe("synthetic late-granted file contents");
  expect(page.url()).toBe(conversationURL);
});
