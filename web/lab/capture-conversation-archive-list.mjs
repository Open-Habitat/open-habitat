// Synthetic lab only: evidence for issues/conversation-archive-list. The
// workspace page's archive with the lab's thirteen archived aurinkokello
// conversations (the titles of Jari's archive of 8.11.2026, invented
// content), two of them with a helper and two with a worker, as in the
// prototype round. 1440 and 390, light and dark, Finnish and English, device
// scale 2. Start the lab in the same shell (scripts/lab.sh start), then from
// web/: node lab/capture-conversation-archive-list.mjs
import { chromium } from "@playwright/test";
import { origin, snapshot } from "./session.mjs";

const out = new URL(
  "../../issues/conversation-archive-list/evidence/",
  import.meta.url,
).pathname;
const id = (n) => `pi:d4d4d4d4-0000-4000-8000-00000000000${n}`;
const run = (n, title, state, resident) => ({
  run_id: `01m6xq1abcdefgh000000000${n}`,
  title,
  created_at: new Date(Date.now() - 4 * 3600000).toISOString(),
  state,
  preserved: false,
  branch: "",
  worktree: "",
  source_branch: "main",
  summary: "",
  ...(resident ? { resident } : {}),
});
// As in the round: two helpers whose landing nobody confirmed, a merged
// worker and an unmerged one.
const runs = {
  [id(2)]: [
    run("0a", "Testaaja", "waiting_parent", {
      name: "testaaja",
      round_state: "waiting",
      rounds: 2,
      landed_round: 1,
    }),
  ],
  [id(4)]: [
    run("0b", "Testi: avustaja", "waiting_parent", {
      name: "testiavustaja",
      round_state: "waiting",
      rounds: 1,
    }),
  ],
  [id(6)]: [run("0c", "Korjaa kirjautumissivun paluuosoite", "merged")],
  [id(8)]: [run("0d", "Päivitä KOKEILTAVAA-lista", "unmerged")],
};

const browser = await chromium.launch({ headless: true });
async function open(width, theme, lang) {
  const phone = width <= 800;
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    viewport: { width, height: phone ? 2400 : 1400 },
    deviceScaleFactor: 2,
    isMobile: phone,
    hasTouch: phone,
    colorScheme: theme,
    locale: lang === "fi" ? "fi-FI" : "en-US",
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  await page.route(/\/api\/v1\/agents\/pi:[^/]+\/spinoffs/, (route) => {
    const parent = new URL(route.request().url()).pathname
      .split("/agents/")[1]
      .split("/spinoffs")[0];
    return route.fulfill({
      json: {
        schema_version: 1,
        parent_id: parent,
        availability: "available",
        runs: runs[parent] ?? [],
        transcripts: [],
      },
    });
  });
  await page.goto(`${origin}/workspaces`);
  await page.getByTestId("github-sign-in").click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
  await page.waitForURL(/\/workspaces/);
  const session = await (
    await page.request.get(`${origin}/auth/session`)
  ).json();
  for (const data of [
    { language: lang === "fi" ? "fi" : "en-US" },
    { experimental: { "explain-mode": true } },
    { experimental: { "named-workers": true } },
  ])
    if (
      !(
        await page.request.put(`${origin}/api/v1/account/preferences`, {
          headers: { Origin: origin, "X-Agent-Host-CSRF": session.csrf },
          data,
        })
      ).ok()
    )
      throw new Error(`preference refused: ${JSON.stringify(data)}`);
  const state = await (
    await page.request.get(`${origin}/api/v1/snapshot`)
  ).json();
  const ws = state.workspaces.find(
    (w) => w.name === "aurinkokello",
  ).workspace_id;
  await page.goto(`${origin}/workspaces/${ws}`);
  await page.locator(".ah-workspace-archive > summary").click();
  const section = page.getByTestId("workspace-archive-panel");
  await section.getByTestId("archive-traces").nth(3).waitFor();
  await section.scrollIntoViewIfNeeded();
  await page.evaluate(() => document.fonts.ready);
  return { context, page, phone, section };
}

const region = '[data-testid="workspace-archive-panel"]';
for (const lang of ["fi", "en"])
  for (const theme of ["light", "dark"])
    for (const width of [1440, 390]) {
      const { context, page, phone, section } = await open(width, theme, lang);
      const name = (step) => `${out}a-${lang}-${step}-${width}-${theme}`;
      const html = theme === "light" && lang === "fi" && !phone;
      const press = (l) => (phone ? l.tap() : l.click());
      try {
        await snapshot(page, name("0-default"), { region, html });
        await section.getByTestId("archive-filter").fill("git");
        await snapshot(page, name("1-filter"), { region, html: false });
        await section.getByTestId("archive-filter").fill("");
        await press(
          section
            .getByTestId("archive-row-open")
            .filter({ hasText: "Testiavustajan tarkoitus" }),
        );
        const foot = page.getByTestId("archived-foot");
        await foot.getByTestId("helper-archive-row").waitFor();
        await page.setViewportSize({ width, height: phone ? 844 : 900 });
        await page.waitForTimeout(300);
        await page.screenshot({ path: `${name("2-read")}.png` });
        if (theme === "light" && !phone) {
          await page.goBack();
          await page.setViewportSize({ width, height: 1400 });
          await section.getByTestId("archive-row").first().waitFor();
          await press(
            page.locator(".ah-rail").getByRole("button", { name: /Alice/ }),
          );
          await press(page.getByTestId("menu-explain"));
          await page.waitForTimeout(400);
          for (const [card, target] of [
            ["T43", section.getByTestId("archive-row-open").nth(1)],
            ["T44", section.locator(".ah-archive-row-restore").nth(1)],
            ["T45", section.getByTestId("archive-traces").first()],
            ["T42", section.getByTestId("archive-filter")],
          ]) {
            await target.scrollIntoViewIfNeeded();
            const box = await target.boundingBox();
            await page.mouse.move(
              box.x + Math.min(30, box.width / 2),
              box.y + box.height / 2,
            );
            await page.waitForTimeout(400);
            await page.screenshot({ path: `${name(`3-explain-${card}`)}.png` });
          }
        }
      } finally {
        await context.close();
      }
    }

// The quiet restore, last, since it changes the lab: the row leaves the
// archive and the status says where it went.
{
  const { context, page, section } = await open(1440, "light", "fi");
  try {
    await section
      .getByTestId("archive-row")
      .filter({ hasText: "Kokeile testikoneella" })
      .getByTestId("restore-conversation")
      .click();
    await section.getByTestId("archive-restored").waitFor();
    await snapshot(page, `${out}a-fi-4-restored-1440-light`, {
      region,
      html: false,
    });
  } finally {
    await context.close();
  }
}
await browser.close();
