import { labWorkerHostPort } from "../test-ports.mjs";
import { createHostTest, expect, type Page } from "../tests/worker-host";
import { snapshot } from "./session.mjs";

// The accepted view card (r2 riff B, r3 riff A) at device scale 2: desktop
// and phone, light and dark, private and public, the durations menu, the
// panel's copy icon, Settings' address list, and a site that shares
// nothing. Synthetic same-UID lab host; writes only into the issue folder.
const out = "../issues/view-card-public-switch/shots";
const port = labWorkerHostPort(0);
const app = `https://app.oh.localhost:${port}`;
const sizes = {
  desktop: { width: 1366, height: 860 },
  phone: { width: 390, height: 844 },
};

async function start(page: Page, theme: string): Promise<string> {
  await page.addInitScript((t) => localStorage.setItem("nah:theme", t), theme);
  await page.request.get("/fixture/scenario?value=ready");
  await page.goto("/workspaces");
  await page.getByTestId("github-sign-in").click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
  await page.goto("/workspaces");
  await page
    .getByRole("main")
    .getByRole("button", { name: /aurinkokello$/ })
    .first()
    .click();
  await expect(page).toHaveURL(/conversation=pi:/);
  const id = new URL(page.url()).searchParams.get("conversation") ?? "";
  for (let i = 0; i < 2; i++)
    expect(
      (
        await page.request.get(`/fixture/view?target=${encodeURIComponent(id)}`)
      ).status(),
    ).toBe(200);
  await expect(page.getByTestId("view-offer")).toHaveCount(2);
  return id;
}

const shot = (page: Page, name: string) =>
  snapshot(page, `${out}/${name}`, { labOrigin: app });

for (const sharing of [true, false]) {
  const test = createHostTest(true, {
    BROWSER_HOST_VIEWS: "1",
    ...(sharing ? { BROWSER_HOST_VIEW_LINKS: "1" } : {}),
  });
  test.use({
    baseURL: app,
    ignoreHTTPSErrors: true,
    deviceScaleFactor: 2,
    launchOptions: {
      args: [`--host-resolver-rules=MAP *.oh.localhost:443 127.0.0.1:${port}`],
    },
  });
  for (const device of ["desktop", "phone"] as const)
    for (const theme of ["light", "dark"]) {
      test(`view card ${sharing ? "sharing" : "no-sharing"} ${device} ${theme}`, async ({
        page,
        context,
      }) => {
        test.skip(!sharing && (device === "phone" || theme === "dark"));
        await context.grantPermissions(["clipboard-read", "clipboard-write"]);
        await page.setViewportSize(sizes[device]);
        await start(page, theme);
        const tag = `${device}-${theme}`;
        if (!sharing) {
          await shot(page, `sharing-off-${tag}`);
          return;
        }
        await shot(page, `private-${tag}`);
        const first = page.getByTestId("view-offer").first();
        await first.getByTestId("view-public").click();
        await expect(first).toHaveAttribute("data-public", "true");
        await shot(page, `public-${tag}`);
        await first.getByTestId("view-public-until").click();
        await expect(page.getByTestId("view-duration-7")).toBeVisible();
        await shot(page, `durations-${tag}`);
        await page.keyboard.press("Escape");
        if (device === "desktop") {
          await first.getByTestId("view-open").click();
          await expect(page.getByTestId("view-panel-copy-link")).toBeVisible();
          await page.waitForTimeout(600);
          await shot(page, `panel-${tag}`);
          await page.goto("/settings/account");
          await expect(page.getByTestId("view-address-row")).toHaveCount(1);
          await shot(page, `settings-${tag}`);
          await page.getByTestId("view-address-remove").click();
          await expect(
            page.getByTestId("view-address-remove-dialog"),
          ).toBeVisible();
          await shot(page, `settings-remove-${tag}`);
        }
      });
    }
}
