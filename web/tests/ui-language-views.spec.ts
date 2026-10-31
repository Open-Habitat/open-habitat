import { workerHostPort } from "../test-ports.mjs";
import { createHostTest, expect } from "./worker-host";

// An agent's view offer and the view panel in English (en-conversation), on
// a host that offers views, as in agent-views.spec.ts. OH_VISUAL_CAPTURE=1
// also writes the issue's English screenshots at device scale 2; the
// synthetic lab offers no views.
const test = createHostTest(false, { BROWSER_HOST_VIEWS: "1" });
const port = workerHostPort(Number(process.env.TEST_PARALLEL_INDEX ?? 0));
const capture = !!process.env.OH_VISUAL_CAPTURE;
const evidence = "../issues/en-conversation/evidence";
test.use({
  baseURL: `https://app.oh.localhost:${port}`,
  launchOptions: {
    args: [`--host-resolver-rules=MAP *.oh.localhost:443 127.0.0.1:${port}`],
  },
  ignoreHTTPSErrors: true,
  viewport: { width: 1366, height: 800 },
  locale: "en-GB",
  deviceScaleFactor: capture ? 2 : 1,
});

test("@ui-language-conversation a view offer and its panel read in English", async ({
  page,
}) => {
  await page.request.get("/fixture/scenario?value=ready");
  await page.goto("/workspaces");
  await page.getByTestId("github-sign-in").click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
  await page
    .getByRole("navigation")
    .getByTestId("workspace-ordinary-dir")
    .click();
  await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
  await expect(page).toHaveURL(/conversation=pi:/);
  const id = new URL(page.url()).searchParams.get("conversation") ?? "";
  const res = await page.request.get(
    `/fixture/view?target=${encodeURIComponent(id)}`,
  );
  expect(res.status()).toBe(200);
  const card = page.getByTestId("view-offer");
  await expect(card).toContainText("The agent offers a view:");
  await expect(card.getByTestId("view-open")).toHaveText("Open");
  if (capture) await page.screenshot({ path: `${evidence}/view-offer.png` });
  await card.getByTestId("view-open").click();
  const panel = page.getByTestId("view-panel");
  await expect(panel).toBeVisible();
  await expect(panel).toContainText("Frozen HTML");
  await expect(panel.getByRole("button", { name: "Close view" })).toBeVisible();
  if (capture) {
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${evidence}/view-panel.png` });
  }
});
