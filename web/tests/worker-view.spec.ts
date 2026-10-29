import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { hostOrigin } from "../test-ports.mjs";
import { createHostTest, expect, type Page } from "./worker-host";

const test = createHostTest();
test.use({
  baseURL: hostOrigin,
  ignoreHTTPSErrors: true,
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
});

const runID = "01m53wnktnxb4w2xgdd79a66de";
// Review material for Jari, never a passing visual comparison.
const capture = process.env.OH_WORKER_VIEW_CAPTURE;
async function shot(page: Page, name: string) {
  if (!capture) return;
  mkdirSync(capture, { recursive: true });
  for (const [width, scheme] of [
    [1440, "light"],
    [390, "dark"],
  ] as const) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    await page.emulateMedia({ colorScheme: scheme });
    await page.screenshot({
      path: resolve(capture, `${name}-${width}-${scheme}.png`),
    });
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ colorScheme: "light" });
}
async function fixture(page: Page, query: string) {
  expect((await page.request.get(`/fixture/taskfleet?${query}`)).status()).toBe(
    204,
  );
}

// The accepted worker view (proto-worker-view, Kehys + Pääte keskustelussa,
// Jari 26.10.2026) through the real gateway and daemon: a Claude Code
// worker's view before its native session exists, after Claude Code files
// it under the worker's own worktree, and once the run has landed.
test("@worker-view @a11y a Claude worker's conversation replaces its terminal card when its history appears, without a composer, desktop and phone", async ({
  page,
}) => {
  test.setTimeout(90000);
  expect(
    (await page.request.get("/fixture/conversations-reset")).status(),
  ).toBe(204);
  await page.request.get("/fixture/scenario?value=ready");
  await page.goto("/workspaces");
  await page
    .getByRole("button")
    .and(page.getByTestId("github-sign-in"))
    .click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
  await page
    .getByRole("navigation")
    .getByRole("link")
    .and(page.getByTestId("workspace-ordinary-dir"))
    .click();
  await page
    .getByRole("button")
    .and(page.getByTestId("conversation-start"))
    .click();
  const composer = page
    .getByRole("textbox")
    .and(page.getByTestId("message-input"));
  await composer.fill("käynnistä worker");
  await page.getByRole("button").and(page.getByTestId("send")).click();
  await expect(page.locator("main")).toContainText(
    'Selvä. Kysyit: "käynnistä worker".',
    { timeout: 20000 },
  );
  const parentURL = page.url();
  const parent = new URL(parentURL).searchParams
    .get("conversation")
    ?.replace(/^pi:/, "");
  expect(parent).toMatch(/^[0-9a-f-]{36}$/);
  const worker = `parent=${parent}&workspace=ordinary-dir&harness=claude`;
  await fixture(page, `${worker}&status=running&history=none`);
  await page.goto(`${parentURL}&spinoff=${runID}`);

  const band = page.getByTestId("worker-band");
  const card = page
    .getByRole("region")
    .and(page.getByTestId("worker-terminal-card"));
  await expect(band).toBeVisible();
  await expect(card).toBeVisible();
  // The brief comes from Taskfleet's run before any history exists.
  await expect(page.locator('[data-voice="brief"]')).toContainText(
    "Lisää kellonäkymälle testit kesäajan vaihtumiselle.",
  );
  await expect(composer).toHaveCount(0);
  // The recorded window is only a pointer: the terminal route, which finds
  // no such Taskfleet window here, refuses it, and the card says so.
  await expect(card.getByTestId("worker-terminal-problem")).toBeVisible();
  // Workers are not listed in the sidebar; the parent row stays current.
  await expect(page.getByRole("navigation")).not.toContainText("ui-test-ok");
  await shot(page, "claude-ei-viela-historiaa");

  await fixture(page, `${worker}&status=running&history=ready`);
  await expect(page.locator("main")).toContainText(
    "Kesäajan vaihde puuttuu testeistä.",
  );
  await expect(card).toHaveCount(0);
  // Claude's Bash call is the conversation's own bash tool row.
  await page
    .getByRole("button")
    .and(page.getByTestId("history-stage-toggle"))
    .first()
    .click();
  await expect(
    page.locator('[data-testid="tool-row"][data-tool-name="bash"]'),
  ).toBeVisible();
  await expect(page.locator(".ah-worker-arrived[role=status]")).toBeVisible();
  // The terminal folds to one row at the end and opens to the whole view.
  await page
    .getByRole("button")
    .and(page.getByTestId("worker-terminal-row"))
    .click();
  await expect(
    page.getByRole("region").and(page.getByTestId("worker-terminal-full")),
  ).toBeVisible();
  await page
    .getByRole("button")
    .and(page.getByTestId("worker-terminal-close"))
    .click();
  await expect(page.getByTestId("worker-terminal-row")).toBeVisible();
  // The history's first message is the brief, shown once.
  await expect(page.locator('[data-voice="brief"]')).toHaveCount(1);
  await expect(composer).toHaveCount(0);
  expect(
    (await new AxeBuilder({ page }).include(".ah-worker-frame").analyze())
      .violations,
  ).toEqual([]);
  await shot(page, "claude-historia-saapui");

  // The phone keeps the band, the ask action and the conversation in view.
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole("button").and(page.getByTestId("worker-ask")),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.scrollingElement?.scrollWidth ?? Number.POSITIVE_INFINITY,
    ),
  ).toBeLessThanOrEqual(390);
  await page.setViewportSize({ width: 1440, height: 900 });

  // No composer: asking goes through the main agent, one press away.
  await page.getByRole("button").and(page.getByTestId("worker-ask")).click();
  await expect(page).not.toHaveURL(/spinoff=/);
  await expect(composer).toBeVisible();

  await fixture(page, `${worker}&status=done&history=ready&landed=1`);
  await page.goto(`${parentURL}&spinoff=${runID}`);
  await expect(
    page.getByRole("complementary").and(page.getByTestId("spinoff-result")),
  ).toHaveAttribute("data-tone", "ok");
  await expect(page.getByTestId("worker-terminal-row")).toHaveCount(0);
  await shot(page, "claude-laskeutui");
  await page.getByRole("button").and(page.getByTestId("parent-top")).click();
  await expect(composer).toBeVisible();
});
