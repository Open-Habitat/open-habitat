import AxeBuilder from "@axe-core/playwright";
import { hostOrigin } from "../test-ports.mjs";
import { confirmGitIdentity } from "./git-identity-helper";
import { expect, type Page, test } from "./worker-host";

// The person's own agent instructions (issue
// new-user-agent-instructions-template):
// onboarding's last step and Settings › Tili › Ohjeet agentille write
// ~/.pi/agent/AGENTS.md through the person's daemon, compare-and-swap. The
// real daemon handler runs in the synthetic host's disposable home.
test.use({
  baseURL: hostOrigin,
  ignoreHTTPSErrors: true,
  viewport: { width: 1280, height: 900 },
  locale: "fi-FI",
  timezoneId: "Europe/Helsinki",
  reducedMotion: "reduce",
});

const api = "/api/v1/account/agent-instructions";
type File = {
  exists: boolean;
  version: string | null;
  content: string;
  claude: string;
};

async function session(page: Page) {
  return (await (await page.request.get("/auth/session")).json()) as {
    csrf: string;
  };
}
async function headers(page: Page) {
  return {
    Origin: new URL(page.url()).origin,
    "X-Agent-Host-CSRF": (await session(page)).csrf,
  };
}
async function file(page: Page): Promise<File> {
  const r = await page.request.get(api);
  expect(r.status()).toBe(200);
  return r.json();
}
const button = (page: Page, id: string) =>
  page.getByRole("button").and(page.getByTestId(id));
const reply = (page: Page, question: string, index: number) =>
  page
    .getByTestId("quick-replies")
    .and(page.locator(`[data-question="${question}"]`))
    .getByRole("button")
    .nth(index);

test("@agent-instructions onboarding's last step writes the note the person saw, through the daemon", async ({
  page,
}) => {
  await page.request.get("/fixture/scenario?value=pi-onboarding");
  await page.request.get("/fixture/pi-state?value=missing");
  try {
    await page.goto("/workspaces");
    await button(page, "github-sign-in").click();
    await page.getByRole("link").nth(0).click();
    await expect(page.getByTestId("git-identity")).toBeVisible();
    await confirmGitIdentity(page);
    await expect(button(page, "repository-proceed")).toBeVisible();
    await expect(
      page.getByTestId("onboarding-step-instructions"),
    ).toHaveAttribute("data-state", "next");
    // Pi turns usable: the AI step ends and the note follows it.
    await page.request.get("/fixture/pi-state?value=usable");
    await button(page, "repository-proceed").click();
    const step = page
      .getByRole("region")
      .and(page.getByTestId("instructions-step"));
    await expect(step).toBeVisible();
    await expect(
      page.getByTestId("onboarding-step-instructions"),
    ).toHaveAttribute("data-state", "current");
    // Nothing is written before Save.
    expect((await file(page)).exists).toBe(false);
    await reply(page, "lang", 0).click();
    await reply(page, "style", 0).click();
    await reply(page, "ask", 1).click();
    const own = "asun tampereella ja opettelen pythonia";
    await page
      .getByRole("textbox")
      .and(page.getByTestId("own-field"))
      .fill(own);
    await button(page, "own-submit").click();
    // A tidier version is offered; the person keeps their own words.
    await reply(page, "tidy", 0).click();
    await expect(page.getByTestId("reveal")).toBeVisible();
    const a11y = await new AxeBuilder({ page })
      .include('[data-testid="instructions-step"]')
      .analyze();
    expect(a11y.violations).toEqual([]);
    await button(page, "editor-save").click();
    await expect(page.getByTestId("route-done")).toHaveAttribute(
      "data-outcome",
      "saved",
    );
    const written = await file(page);
    expect(written.exists).toBe(true);
    expect(written.content).toContain(`\n${own}\n`);
    expect(written.claude).toBe("imports");
    await button(page, "enter-habitat").click();
    await expect(
      page.getByRole("heading").and(page.getByTestId("workspaces-title")),
    ).toBeVisible();
  } finally {
    await page.request.get("/fixture/pi-state?value=missing");
    await page.request.get("/fixture/scenario?value=ready");
  }
});

test("@agent-instructions Settings saves compare-and-swap, merges a change made meanwhile and adds with the agent", async ({
  page,
}) => {
  await page.request.get("/fixture/scenario?value=ready");
  await page.goto("/workspaces");
  await button(page, "github-sign-in").click();
  await page.getByRole("link").nth(0).click();
  await expect(button(page, "account-menu-trigger")).toBeAttached();
  await page.goto("/settings/tili");
  const block = page.getByTestId("agent-instructions-settings");
  await expect(block.getByTestId("editor-empty")).toBeVisible();
  const editorTab = block.getByRole("tab").nth(1);
  const text = block.getByRole("textbox").and(block.getByTestId("editor-text"));

  // The first save creates the file and Claude's import line.
  await editorTab.click();
  await text.fill("# Mine\n\nfirst\n\nsecond\n");
  await button(page, "editor-save").click();
  await expect(block.getByTestId("editor-saved")).toBeVisible();
  const first = await file(page);
  expect(first.content).toBe("# Mine\n\nfirst\n\nsecond\n");
  expect(first.claude).toBe("imports");
  await expect(block.getByTestId("instructions-source")).toHaveAttribute(
    "data-claude",
    "imports",
  );

  // Another writer (another tab, an agent) changes the file meanwhile.
  const other = "# Mine\n\nfirst\n\nsecond\n\nthird from elsewhere\n";
  expect(
    (
      await page.request.put(api, {
        headers: await headers(page),
        data: { base_version: first.version, content: other },
      })
    ).status(),
  ).toBe(200);
  await editorTab.click();
  await text.fill("# Mine\n\nfirst edited\n\nsecond\n");
  await button(page, "editor-save").click();
  await expect(block.getByTestId("editor-merged")).toBeVisible();
  expect((await file(page)).content).toBe(other);
  await editorTab.click();
  await expect(text).toHaveValue(
    "# Mine\n\nfirst edited\n\nsecond\n\nthird from elsewhere\n",
  );
  await button(page, "editor-save").click();
  await expect(block.getByTestId("editor-saved")).toBeVisible();
  const merged = await file(page);
  expect(merged.content).toBe(
    "# Mine\n\nfirst edited\n\nsecond\n\nthird from elsewhere\n",
  );
  const a11y = await new AxeBuilder({ page })
    .include('[data-testid="agent-instructions-settings"]')
    .analyze();
  expect(a11y.violations).toEqual([]);

  // With the agent: an existing note is not asked a language and is kept
  // byte for byte; the new part follows it.
  await button(page, "instructions-with-agent").click();
  await expect(block.getByTestId("instructions-step")).toBeVisible();
  await expect(page.locator('[data-question="lang"]')).toHaveCount(0);
  await reply(page, "style", 1).click();
  await reply(page, "ask", 0).click();
  await button(page, "own-skip").click();
  await expect(block.getByTestId("editor-kept")).toBeVisible();
  await expect(block.getByTestId("editor-added")).toBeVisible();
  await button(page, "editor-save").click();
  await expect(block.getByTestId("instructions-step")).toHaveCount(0);
  await expect(block.getByTestId("instructions-editor")).toBeVisible();
  const added = await file(page);
  expect(added.content.startsWith(merged.content)).toBe(true);
  expect(added.content.length).toBeGreaterThan(merged.content.length);
});
