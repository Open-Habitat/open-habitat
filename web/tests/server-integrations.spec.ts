import AxeBuilder from "@axe-core/playwright";
import { hostOrigin } from "../test-ports.mjs";
import { expect, type Page, test } from "./worker-host";

test.use({
  baseURL: hostOrigin,
  ignoreHTTPSErrors: true,
  viewport: { width: 1280, height: 900 },
});

// The synthetic host's integrations file starts with Google and Microsoft
// set by root; its Dropbox entry is the production one, whose rclone the
// host lacks. /fixture/integration-apps clears an app, delays the broker's
// writes so the wait shows, loses the next write's reply, or installs a
// stand-in rclone.

const googleID =
  "915508263417-a8d2kq0zr7m3vh1ts9pe5wybc6lfnjxu.apps.googleusercontent.com";

async function signIn(page: Page) {
  await page.goto("/settings");
  await page
    .getByRole("button")
    .and(page.getByTestId("github-sign-in"))
    .click();
  await page.getByRole("link").nth(0).click();
  await expect(page).not.toHaveURL(/fixture\/provider/);
}
const fixture = async (page: Page, query: string) =>
  expect(
    (await page.request.get(`/fixture/integration-apps?${query}`)).status(),
  ).toBe(204);
/** Whether the administrator's own daemon offers a provider to connect. */
const available = async (page: Page, provider: string) =>
  (
    (await (await page.request.get("/api/v1/integrations")).json()) as {
      providers: { id: string; available: boolean }[];
    }
  ).providers.find((p) => p.id === provider)?.available;
const googleAvailable = (page: Page) => available(page, "google");

async function enterGoogle(page: Page, walk: boolean) {
  const dialog = page.getByTestId("si-setup-dialog");
  if (walk) {
    for (const step of ["apis", "audience", "scopes"]) {
      await expect(dialog.getByTestId("si-stepname")).toHaveAttribute(
        "data-step",
        step,
      );
      await dialog
        .getByRole("button")
        .and(dialog.getByTestId("si-next"))
        .click();
    }
    // The client is created and its values typed on the same step.
    await expect(dialog.getByTestId("si-stepname")).toHaveAttribute(
      "data-step",
      "client",
    );
  } else {
    await dialog.getByRole("button").and(dialog.getByTestId("si-skip")).click();
    await expect(dialog.getByTestId("si-step-enter")).toBeVisible();
  }
  await dialog.getByTestId("si-field-client_id").fill(googleID);
  await dialog.getByTestId("si-field-client_secret").fill("GOCSPX-synthetic");
  await dialog.getByRole("button").and(dialog.getByTestId("si-save")).click();
}

test("@server-integrations an administrator sets Google's app credentials and removes them; people's catalog follows", async ({
  page,
}) => {
  await signIn(page);
  await fixture(page, "clear=google&delay=600");
  await page.goto("/settings/server-integrations");
  const row = (p: string) => page.getByTestId(`si-row-${p}`);
  await expect(row("google")).toHaveAttribute("data-status", "needs_app");
  await expect(row("imap")).toHaveAttribute("data-status", "ready");
  await expect(row("apple")).toHaveAttribute("data-status", "ready");
  await expect(row("apple").getByRole("button")).toHaveCount(0);
  await expect(page.getByTestId("si-step-apple")).toHaveCount(0);
  expect(await available(page, "apple")).toBe(true);
  await expect(page.getByTestId("si-connect-note")).toBeVisible();
  await expect(row("dropbox")).toHaveAttribute("data-status", "tool_missing");
  expect(await googleAvailable(page)).toBe(false);

  // A missing tool is fixed on the server, with one command.
  await page
    .getByRole("button")
    .and(page.getByTestId("si-fix-dropbox"))
    .click();
  await expect(page.getByTestId("si-fix-command")).toBeVisible();
  await page.keyboard.press("Escape");

  await page
    .getByRole("button")
    .and(page.getByTestId("si-setup-google"))
    .click();
  await enterGoogle(page, true);
  // The dialog waits for the broker; the row says so too.
  await expect(row("google")).toHaveAttribute("data-status", "set");
  await expect(page.getByTestId("si-setup-dialog")).toHaveCount(0);
  await expect(row("google")).toHaveAttribute("data-status", "ready");
  expect(await googleAvailable(page)).toBe(true);
  await page.reload();
  await expect(row("google")).toHaveAttribute("data-status", "ready");

  await page.getByTestId("si-menu-google").getByRole("button").click();
  await page.getByTestId("menu-remove").click();
  await page
    .getByRole("dialog")
    .getByRole("button")
    .and(page.getByTestId("si-remove-confirm"))
    .click();
  await expect(row("google")).toHaveAttribute("data-status", "clear");
  await expect(row("google")).toHaveAttribute("data-status", "needs_app");
  expect(await googleAvailable(page)).toBe(false);
});

test("@server-integrations @a11y a lost broker reply stays uncertain until read again; the tab and the guide fit a phone", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/settings/onboarding");
  await page
    .getByRole("button")
    .and(page.getByTestId("onboarding-route-add-integration"))
    .click();
  await page
    .getByRole("button")
    .and(page.getByTestId("onboarding-add-apple"))
    .click();
  await expect
    .poll(
      async () =>
        (await (await page.request.get("/api/v1/server/onboarding")).json())
          .integrations,
    )
    .toEqual([{ provider: "apple", required: false }]);
  await fixture(page, "clear=google");
  await page.goto("/settings/server-integrations");
  await expect(page.getByTestId("si-step-apple")).toBeVisible();
  await expect(page.getByTestId("si-step-apple")).not.toHaveAttribute(
    "data-hidden",
    "true",
  );
  const google = page.getByTestId("si-row-google");
  await expect(google).toHaveAttribute("data-status", "needs_app");
  expect(
    (
      await new AxeBuilder({ page })
        .include("[data-testid=server-integrations]")
        .analyze()
    ).violations,
  ).toEqual([]);
  const overflow = () =>
    page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  // Every row's name, status and action occupy separate boxes inside the
  // row, and the name stays on one line.
  const collisions = () =>
    page.getByTestId("si-rows").evaluate((list) => {
      const hit = (a: DOMRect, b: DOMRect) =>
        a.left < b.right - 0.5 &&
        b.left < a.right - 0.5 &&
        a.top < b.bottom - 0.5 &&
        b.top < a.bottom - 0.5;
      const out: string[] = [];
      for (const row of Array.from(
        list.querySelectorAll("[data-testid^=si-row-]"),
      )) {
        const id = row.getAttribute("data-testid");
        const box = row.getBoundingClientRect();
        const name = row.querySelector(".si-name");
        const parts = [
          name,
          row.querySelector(".ah-people-cell > *"),
          row.querySelector(".ah-people-end > *"),
        ].map((e) => e?.getBoundingClientRect());
        if (name?.getClientRects().length !== 1) out.push(`${id}: name wraps`);
        parts.forEach((a, i) => {
          if (!a) return;
          if (a.left < box.left - 0.5 || a.right > box.right + 0.5)
            out.push(`${id}: part ${i} leaves the row`);
          parts.slice(i + 1).forEach((b, j) => {
            if (b && hit(a, b)) out.push(`${id}: ${i} overlaps ${i + j + 1}`);
          });
        });
      }
      return out;
    });
  for (const width of [1366, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await expect(google).toBeVisible();
    expect(await collisions()).toEqual([]);
    expect(await overflow()).toBeLessThanOrEqual(0);
  }
  await page
    .getByRole("button")
    .and(page.getByTestId("si-setup-google"))
    .click();
  const dialog = page.getByTestId("si-setup-dialog");
  await dialog.getByRole("button").and(dialog.getByTestId("si-next")).click();
  await dialog.getByRole("button").and(dialog.getByTestId("si-next")).click();
  await expect(dialog.getByTestId("si-scopes")).toBeVisible();
  expect(await overflow()).toBeLessThanOrEqual(0);
  await dialog.getByRole("button").and(dialog.getByTestId("si-next")).click();
  // The last step's console side and its values: stacked on a phone, side
  // by side on a desktop.
  const split = dialog.getByTestId("si-split");
  const placement = () =>
    split.evaluate((el) => {
      const [left, get] = Array.from(el.children).map((c) =>
        c.getBoundingClientRect(),
      );
      return {
        below: get.top >= left.bottom - 0.5,
        beside: get.left >= left.right - 0.5 && get.top < left.bottom,
      };
    });
  await expect(split).toBeVisible();
  expect(await placement()).toEqual({ below: true, beside: false });
  expect(await overflow()).toBeLessThanOrEqual(0);
  expect(
    (
      await new AxeBuilder({ page })
        .include("[data-testid=si-setup-dialog]")
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.setViewportSize({ width: 1280, height: 900 });
  expect(await placement()).toEqual({ below: false, beside: true });
  for (let i = 0; i < 3; i++)
    await dialog.getByRole("button").and(dialog.getByTestId("si-back")).click();

  await fixture(page, "lose=1");
  await enterGoogle(page, false);
  await expect(google).toHaveAttribute("data-status", "uncertain");
  await page
    .getByRole("button")
    .and(page.getByTestId("si-refresh-google"))
    .click();
  // The broker committed it; the reply was only lost.
  await expect(google).toHaveAttribute("data-status", "ready");
});

test("@server-integrations @a11y an administrator sets Microsoft's level apps in one guided walk, skipping the ones set, and removes them", async ({
  page,
}) => {
  await signIn(page);
  await fixture(page, "clear=microsoft&delay=600");
  await page.goto("/settings/server-integrations");
  const row = page.getByTestId("si-row-microsoft");
  await expect(row).toHaveAttribute("data-status", "needs_app");
  expect(await available(page, "microsoft")).toBe(false);
  // The levels' table is behind its button on the page.
  await expect(page.getByTestId("si-table-microsoft")).toHaveCount(0);
  await page.getByTestId("si-levels-microsoft").click();
  await expect(
    page.getByTestId("si-table-microsoft").locator("thead th"),
  ).toHaveCount(5);

  await row
    .getByRole("button")
    .and(page.getByTestId("si-setup-microsoft"))
    .click();
  const dialog = page.getByTestId("ml-dialog");
  const begin = dialog.getByTestId("ml-begin");
  await expect(begin).toHaveText("Aloita: 4 tasoa");
  // Only the full and the no-send level now; the rest wait.
  await dialog.getByTestId("ml-pick-drafts").click();
  await dialog.getByTestId("ml-pick-read").click();
  await expect(begin).toHaveText("Aloita: 2 tasoa");
  await begin.click();
  await expect(dialog.getByTestId("ml-console-link")).toHaveAttribute(
    "href",
    /^https:\/\/entra\.microsoft\.com\//,
  );
  const stepname = dialog.getByTestId("ml-stepname");
  const next = dialog.getByRole("button").and(dialog.getByTestId("ml-next"));
  const save = dialog.getByRole("button").and(dialog.getByTestId("ml-save"));
  const steps: string[] = [];
  while (!(await save.count())) {
    const step = (await stepname.getAttribute("data-step")) ?? "";
    if (steps.at(-1) !== step) steps.push(step);
    await next.click();
  }
  expect(steps).toEqual(["register", "public", "permissions", "consent"]);
  // The walk's longest sub-item fits a phone.
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - innerWidth,
    ),
  ).toBeLessThanOrEqual(0);
  expect(
    (
      await new AxeBuilder({ page })
        .include("[data-testid=ml-dialog]")
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.setViewportSize({ width: 1280, height: 900 });
  // Nothing set yet: the tenant is asked once. A save without the client
  // id opens its sub-item, and an audience keyword is refused in its field
  // before the broker.
  await dialog.getByTestId("ml-field-tenant").fill("common");
  await save.click();
  await expect(dialog.getByTestId("ml-field-client-full")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await dialog
    .getByTestId("ml-field-client-full")
    .fill("3f2a91c4-7d0e-4b6a-9c15-e8a4b2d7f031");
  await next.click();
  await save.click();
  await expect(dialog.getByTestId("ml-field-tenant")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await dialog
    .getByTestId("ml-field-tenant")
    .fill("b81e5c27-4a93-4f0d-86c2-1d9e7a3f5b60");
  await save.click();
  await expect(row).toHaveAttribute("data-status", "set");
  // Saved: the next chosen level starts, with the saved tenant reused.
  await expect(stepname).toHaveAttribute("data-level", "nosend");
  await expect(row).toHaveAttribute("data-status", "ready");
  expect(await available(page, "microsoft")).toBe(true);
  while (!(await save.count())) await next.click();
  await expect(dialog.getByTestId("ml-tenant-known")).toHaveText(
    "b81e5c27-4a93-4f0d-86c2-1d9e7a3f5b60",
  );
  await dialog.getByRole("button").and(dialog.getByTestId("ml-back")).click();
  // The full level's id again is refused.
  await dialog
    .getByTestId("ml-field-client-nosend")
    .fill("3f2a91c4-7d0e-4b6a-9c15-e8a4b2d7f031");
  await next.click();
  await save.click();
  await expect(dialog.getByTestId("ml-field-client-nosend")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await dialog
    .getByTestId("ml-field-client-nosend")
    .fill("6d1c0b2e-8f47-4a39-b5e2-7c9a0d3f1e84");
  await next.click();
  await save.click();
  // Back to the start, the two saved and the two left unticked offered.
  await expect(dialog).toHaveAttribute("data-page", "start");
  await expect(dialog.getByTestId("ml-just")).toContainText(
    "Täysi, Ei lähetystä",
  );
  await expect(dialog.getByTestId("ml-set-nosend")).toBeVisible();
  await expect(row.getByTestId("si-levels-note")).toHaveText(
    "2/4 tasoa asetettu: Täysi · Ei lähetystä",
  );

  // A level's removal leaves the provider; the last one removes it.
  await dialog.getByTestId("ml-remove-nosend").click();
  const confirm = page.getByTestId("si-remove-dialog");
  await expect(confirm.getByTestId("si-remove-other")).toHaveCount(0);
  await confirm
    .getByRole("button")
    .and(page.getByTestId("si-remove-confirm"))
    .click();
  await expect(row.getByTestId("si-levels-note")).toHaveText(
    "1/4 tasoa asetettu: Täysi",
  );
  await row
    .getByRole("button")
    .and(page.getByTestId("si-setup-microsoft"))
    .click();
  await dialog.getByTestId("ml-remove-full").click();
  await expect(confirm.getByTestId("si-remove-other")).toBeVisible();
  await confirm
    .getByRole("button")
    .and(page.getByTestId("si-remove-confirm"))
    .click();
  await expect(row).toHaveAttribute("data-status", "needs_app");
  expect(await available(page, "microsoft")).toBe(false);
});

test("@server-integrations @a11y an administrator sets Dropbox's app through the App Console guide and removes it; people's catalog follows", async ({
  page,
}) => {
  await signIn(page);
  await fixture(page, "rclone=1&delay=600");
  await page.goto("/settings/server-integrations");
  const row = page.getByTestId("si-row-dropbox");
  await expect(row).toHaveAttribute("data-status", "needs_app");
  expect(await available(page, "dropbox")).toBe(false);

  await page
    .getByRole("button")
    .and(page.getByTestId("si-setup-dropbox"))
    .click();
  const dialog = page.getByTestId("si-setup-dialog");
  await expect(dialog.getByTestId("si-console-link")).toHaveAttribute(
    "href",
    "https://www.dropbox.com/developers/apps/create",
  );
  for (const step of ["create", "permissions"]) {
    await expect(dialog.getByTestId("si-stepname")).toHaveAttribute(
      "data-step",
      step,
    );
    if (step === "create") {
      await page.setViewportSize({ width: 390, height: 844 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth - innerWidth,
        ),
      ).toBeLessThanOrEqual(0);
      expect(
        (
          await new AxeBuilder({ page })
            .include("[data-testid=si-setup-dialog]")
            .analyze()
        ).violations,
      ).toEqual([]);
      await page.setViewportSize({ width: 1280, height: 900 });
    }
    await dialog.getByRole("button").and(dialog.getByTestId("si-next")).click();
  }
  // The guide ends on the Settings page, which also shows the keys.
  await expect(dialog.getByTestId("si-stepname")).toHaveAttribute(
    "data-step",
    "settings",
  );
  await dialog.getByTestId("si-field-client_id").fill("p3n8vq1zt6ka0rw");
  // The App key pasted twice is refused in its field, before the broker.
  await dialog.getByTestId("si-field-client_secret").fill("p3n8vq1zt6ka0rw");
  await dialog.getByRole("button").and(dialog.getByTestId("si-save")).click();
  await expect(dialog.getByTestId("si-field-client_secret")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await dialog.getByTestId("si-field-client_secret").fill("h2m5c9xj4ub7ye1");
  await dialog.getByRole("button").and(dialog.getByTestId("si-save")).click();
  await expect(row).toHaveAttribute("data-status", "set");
  await expect(dialog).toHaveCount(0);
  await expect(row).toHaveAttribute("data-status", "ready");
  // Only the App key comes back; the secret never leaves root's file.
  const list = await (
    await page.request.get("/api/v1/server/integrations")
  ).text();
  expect(list).toContain("p3n8vq1zt6ka0rw");
  expect(list).not.toContain("h2m5c9xj4ub7ye1");
  expect(await available(page, "dropbox")).toBe(true);

  // Dropbox renews no secret on request: removal is the only change, and the
  // menu keeps the Development-status rule.
  await page.getByTestId("si-menu-dropbox").getByRole("button").click();
  await expect(page.getByTestId("menu-remove")).toBeVisible();
  await expect(page.getByTestId("si-limit-note")).toBeVisible();
  await expect(page.getByTestId("menu-replace")).toHaveCount(0);
  await page.getByTestId("menu-remove").click();
  await expect(page.getByTestId("si-sync-stops")).toBeVisible();
  await page
    .getByRole("dialog")
    .getByRole("button")
    .and(page.getByTestId("si-remove-confirm"))
    .click();
  await expect(row).toHaveAttribute("data-status", "needs_app");
  expect(await available(page, "dropbox")).toBe(false);
});
