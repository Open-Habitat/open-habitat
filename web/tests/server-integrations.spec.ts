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
// writes so the wait shows, or loses the next write's reply.

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
/** Whether the administrator's own daemon offers Google to connect. */
const googleAvailable = async (page: Page) =>
  (
    (await (await page.request.get("/api/v1/integrations")).json()) as {
      providers: { id: string; available: boolean }[];
    }
  ).providers.find((p) => p.id === "google")?.available;

async function enterGoogle(page: Page, walk: boolean) {
  const dialog = page.getByTestId("si-setup-dialog");
  if (walk)
    for (const step of ["apis", "audience", "scopes", "client"]) {
      await expect(dialog.getByTestId("si-stepname")).toHaveAttribute(
        "data-step",
        step,
      );
      await dialog
        .getByRole("button")
        .and(dialog.getByTestId("si-next"))
        .click();
    }
  else
    await dialog.getByRole("button").and(dialog.getByTestId("si-skip")).click();
  await expect(dialog.getByTestId("si-stepname")).toHaveAttribute(
    "data-step",
    "enter",
  );
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
  await fixture(page, "clear=google");
  await page.goto("/settings/server-integrations");
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
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(google).toBeVisible();
  expect(await overflow()).toBeLessThanOrEqual(0);
  await page
    .getByRole("button")
    .and(page.getByTestId("si-setup-google"))
    .click();
  const dialog = page.getByTestId("si-setup-dialog");
  await dialog.getByRole("button").and(dialog.getByTestId("si-next")).click();
  await dialog.getByRole("button").and(dialog.getByTestId("si-next")).click();
  await expect(dialog.getByTestId("si-scopes")).toBeVisible();
  expect(await overflow()).toBeLessThanOrEqual(0);
  expect(
    (
      await new AxeBuilder({ page })
        .include("[data-testid=si-setup-dialog]")
        .analyze()
    ).violations,
  ).toEqual([]);
  await dialog.getByRole("button").and(dialog.getByTestId("si-back")).click();
  await dialog.getByRole("button").and(dialog.getByTestId("si-back")).click();
  await page.setViewportSize({ width: 1280, height: 900 });

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
