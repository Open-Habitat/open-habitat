import { mkdir, writeFile } from "node:fs/promises";
import AxeBuilder from "@axe-core/playwright";
import { hostOrigin } from "../test-ports.mjs";
import { expect, type Page, test } from "./worker-host";

// Settings › Tallennustila with the storage-breakdown experiment (issue
// storage-warning-no-breakdown, round 2 direction B1): the person's daemon
// measures their home, the bar previews the selection against the limit and
// the 85 % line, and the button opens a new conversation with the clean-up
// request in its field, unsent.
test.use({
  baseURL: hostOrigin,
  ignoreHTTPSErrors: true,
  viewport: { width: 1280, height: 900 },
});

const G = 1024 ** 3;
const breakdown = {
  schema_version: 1,
  measuring: false,
  measured_at: "2030-01-01T09:12:00Z",
  complete: true,
  items: [
    {
      group: "caches",
      kind: "go-build",
      path: "~/.cache/go-build",
      bytes: 20 * G,
      complete: true,
    },
    {
      group: "caches",
      kind: "npm",
      path: "~/.npm/_cacache",
      bytes: 3 * G,
      complete: true,
    },
    {
      group: "finished",
      kind: "target",
      path: "~/src/app__worktrees/wt-old/target",
      bytes: 9 * G,
      complete: true,
      workspace: "app__worktrees",
      run_id: "01m7cccccccccccccccccccccc",
      title: "Old search",
    },
    {
      group: "live",
      kind: "target",
      path: "~/src/app__worktrees/wt-new/target",
      bytes: 14 * G,
      complete: true,
      workspace: "app__worktrees",
      run_id: "01m7aaaaaaaaaaaaaaaaaaaaaa",
      title: "Calendar",
    },
    {
      group: "own",
      kind: "node_modules",
      path: "~/src/site/node_modules",
      bytes: 1 * G,
      complete: true,
      workspace: "site",
    },
    {
      group: "trash",
      kind: "trash",
      path: "~/.local/share/Trash",
      bytes: 4 * G,
      complete: true,
    },
  ],
};

test("@storage-breakdown cloud-heavy home has named read-only groups and empty trash", async ({
  page,
}) => {
  await signIn(page);
  await setFeature(page, true);
  await page.route("**/api/v1/account/storage", (route) =>
    route.fulfill({
      json: { schema_version: 1, usage_bytes: 12 * G, limit_bytes: 14 * G },
    }),
  );
  const data = [
    {
      group: "dropbox",
      kind: "dropbox",
      path: "~/cloud/dropbox/person@example.test",
      bytes: 7 * G,
    },
    {
      group: "onedrive",
      kind: "onedrive",
      path: "~/cloud/onedrive/person@example.test",
      bytes: G,
    },
    {
      group: "offered",
      kind: "offered",
      path: "~/.local/state/open-habitat/files",
      bytes: G,
    },
    {
      group: "history",
      kind: "history",
      path: "~/.pi/agent/sessions",
      bytes: G / 2,
    },
    { group: "workspaces", kind: "workspace", path: "~/src/app", bytes: 2 * G },
    { group: "caches", kind: "npm", path: "~/.npm/_cacache", bytes: 73728 },
    {
      group: "trash",
      kind: "trash",
      path: "~/.local/share/Trash/files",
      bytes: 0,
    },
  ];
  await page.route("**/api/v1/account/storage/breakdown", (route) =>
    route.fulfill({
      json: {
        ...breakdown,
        items: data.map((i) => ({ ...i, complete: true })),
      },
    }),
  );
  await page.goto("/settings/storage");
  const card = page.getByTestId("storage-breakdown");
  await expect(card.getByTestId("group-list")).toBeVisible();
  for (const group of [
    "dropbox",
    "onedrive",
    "offered",
    "history",
    "workspaces",
  ]) {
    await expect(card.locator(`[data-part="${group}"]`)).toHaveCount(1);
    await card.getByTestId(`more-${group}`).click();
    await expect(
      card.locator(`[data-group-row="${group}"]`).getByRole("checkbox"),
    ).toHaveCount(0);
    await expect(
      card.locator(`[data-details="${group}"] .ah-sb-path`),
    ).toBeVisible();
    await card.getByTestId(`more-${group}`).click();
  }
  await expect(card.locator('[data-group-row="trash"] .ah-sb-size')).toHaveText(
    "0 B",
  );
  await expect(card.locator('[data-part="trash"]')).toHaveCount(0);
  expect(
    (
      await new AxeBuilder({ page })
        .include('[data-testid="storage-breakdown"]')
        .analyze()
    ).violations,
  ).toEqual([]);
  if (process.env.OH_STORAGE_SCREENSHOT_DIR) {
    const dir = process.env.OH_STORAGE_SCREENSHOT_DIR;
    await mkdir(dir, { recursive: true });
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.screenshot({
        path: `${dir}/storage-${width}.png`,
        fullPage: true,
      });
      await writeFile(`${dir}/storage-${width}.html`, await page.content());
    }
    const session = await (await page.request.get("/auth/session")).json();
    const preferences = async (data: object) => {
      const reply = await page.request.put("/api/v1/account/preferences", {
        headers: {
          Origin: new URL(page.url()).origin,
          "X-Agent-Host-CSRF": session.csrf,
        },
        data,
      });
      expect(reply.ok()).toBe(true);
    };
    await preferences({ experimental: { "explain-mode": true } });
    for (const language of ["fi", "en-US"]) {
      await preferences({ language });
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.reload();
      await page.getByTestId("account-menu-trigger").click();
      await page.getByTestId("menu-explain").click();
      for (const width of [1440, 390]) {
        await page.setViewportSize({ width, height: 1000 });
        for (const [control, id] of [
          ["more-dropbox", "M84"],
          ["cleanup-ask", "M83"],
        ]) {
          await page.getByTestId(control).hover();
          await expect(page.getByTestId("explain-card")).toHaveAttribute(
            "data-card",
            id,
          );
          await page.screenshot({
            path: `${dir}/explain-${language}-${width}-${id}.png`,
            fullPage: true,
          });
          await writeFile(
            `${dir}/explain-${language}-${width}-${id}.html`,
            await page.content(),
          );
        }
      }
    }
  }
});

async function signIn(page: Page) {
  await page.goto("/settings");
  await page.getByTestId("github-sign-in").click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
  await expect(page.getByRole("link", { name: "Tallennustila" })).toBeVisible();
}

async function setFeature(page: Page, on: boolean) {
  const session = await (await page.request.get("/auth/session")).json();
  const reply = await page.request.put("/api/v1/account/preferences", {
    headers: {
      Origin: new URL(page.url()).origin,
      "X-Agent-Host-CSRF": session.csrf,
    },
    data: { experimental: { "storage-breakdown": on } },
  });
  expect(reply.ok()).toBe(true);
}

test("@storage-breakdown the daemon measures the home and the selection becomes an unsent clean-up request @a11y", async ({
  page,
}) => {
  await signIn(page);
  // The real daemon answers at once and measures in the background; its
  // paths are all below the home.
  const first = await page.request.get("/api/v1/account/storage/breakdown");
  expect(first.ok()).toBe(true);
  expect(typeof (await first.json()).measuring).toBe("boolean");
  await expect
    .poll(
      async () =>
        (
          await (
            await page.request.get("/api/v1/account/storage/breakdown")
          ).json()
        ).measuring,
      { timeout: 60_000 },
    )
    .toBe(false);
  const measured = await (
    await page.request.get("/api/v1/account/storage/breakdown")
  ).json();
  expect(measured.measured_at).toBeTruthy();
  for (const item of measured.items) expect(item.path).toMatch(/^~\//);

  // New accounts need no experimental choice.
  await page.goto("/settings/storage");
  await expect(page.getByTestId("storage-breakdown")).toBeVisible();
  await page.route("**/api/v1/account/storage", (route) =>
    route.fulfill({
      json: { schema_version: 1, usage_bytes: 115 * G, limit_bytes: 128 * G },
    }),
  );
  await page.route("**/api/v1/account/storage/breakdown", (route) =>
    route.fulfill({ json: breakdown }),
  );
  let creations = 0;
  await page.route("**/api/v1/conversations", async (route) => {
    if (route.request().method() === "POST") creations++;
    // Creation is held: the request must already wait in the field.
    if (route.request().method() !== "POST") await route.continue();
  });
  await page.reload();
  const card = page.getByTestId("storage-breakdown");
  await expect(card).toBeVisible();
  // The workspace Trash list is empty in this fixture; it must not replace
  // the breakdown's measurement (which also includes regular files).
  await expect(card.locator('[data-group-row="trash"] .ah-sb-size')).toHaveText(
    "4 GiB",
  );
  await expect(page.getByTestId("storage-warning")).toContainText("89 %");
  await expect(card.getByTestId("frees")).toContainText("32");
  await expect(card.getByTestId("after")).toContainText("64 %");
  await expect(card.getByTestId("verdict")).toHaveAttribute("data-ok", "true");
  await expect(card.getByTestId("warn-line")).toBeAttached();
  // Plain groups by default; paths only behind Show details.
  await expect(card.getByText("~/.cache/go-build")).toHaveCount(0);
  await card.getByTestId("more-finished").click();
  await expect(
    card.getByText("~/src/app__worktrees/wt-old/target"),
  ).toBeVisible();
  // Work in progress cannot be chosen.
  await expect(
    card.locator('[data-group-row="live"]').getByRole("checkbox"),
  ).toBeDisabled();
  expect(
    (
      await new AxeBuilder({ page })
        .include('[data-testid="storage-breakdown"]')
        .analyze()
    ).violations,
  ).toEqual([]);
  // Leaving the caches out moves the preview.
  await card.getByTestId("group-caches").click();
  await expect(card.getByTestId("frees")).toContainText("9");
  await expect(card.getByTestId("after")).toContainText("82 %");

  await card.getByTestId("cleanup-ask").click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const request = page.getByTestId("message-input");
  await expect(request).toHaveValue(/wt-old\/target \(9 GiB\): cargo clean/);
  await expect(request).not.toHaveValue(/go-build/);
  await expect(request).toHaveValue(
    /Älä koske käynnissä olevien workerien hakemistoihin:\n- ~\/src\/app__worktrees\/wt-new\/target/,
  );
  await expect(page).toHaveURL(/\/workspaces\/[^/?]+\?conversation=new$/);
  expect(creations).toBe(1);
  await setFeature(page, false);
});
