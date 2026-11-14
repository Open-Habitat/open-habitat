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

  // Off: Storage is as before.
  await page.goto("/settings/storage");
  await expect(page.getByTestId("storage-usage")).toBeVisible();
  await expect(page.getByTestId("storage-breakdown")).toHaveCount(0);

  await setFeature(page, true);
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

  await card.getByTestId("ask-agent").click();
  const dialog = page.getByRole("dialog");
  const request = dialog.getByTestId("request-text");
  await expect(request).toHaveValue(/wt-old\/target \(9 GiB\): cargo clean/);
  await expect(request).not.toHaveValue(/go-build/);
  await expect(request).toHaveValue(
    /Älä koske käynnissä olevien workerien hakemistoihin:\n- ~\/src\/app__worktrees\/wt-new\/target/,
  );
  const text = await request.inputValue();
  await dialog.getByTestId("cleanup-open").click();
  await expect(page).toHaveURL(/\/workspaces\/[^/?]+\?conversation=new$/);
  await expect(page.getByTestId("message-input")).toHaveValue(text);
  expect(creations).toBe(1);
  await setFeature(page, false);
});
