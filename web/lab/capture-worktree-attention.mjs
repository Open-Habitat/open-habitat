// Synthetic lab only: evidence for issues/worktree-list-attention. The
// workspace page's worktree section with the prototype's five rows (Jari's
// case of 8.11.2026, invented names) served in place of the lab's own
// listing, at 1440 and 390, light and dark, Finnish and English, device
// scale 2. Start the lab in the same shell (scripts/lab.sh start), then from
// web/: node lab/capture-worktree-attention.mjs
import { chromium } from "@playwright/test";
import { origin, snapshot } from "./session.mjs";

const out = new URL(
  "../../issues/worktree-list-attention/evidence/",
  import.meta.url,
).pathname;
const live = "pi:a1a1a1a1-0000-4000-8000-000000000001";
const archived = "pi:a1a1a1a1-0000-4000-8000-000000000002";
const MiB = 1024 * 1024;
const at = (min) =>
  new Date(Date.now() + min * 60000).toISOString().replace(/\.\d+Z$/, "Z");

function listing(ws) {
  let n = 0;
  const wt = (name, state, owner, over = {}) => ({
    workspace_id: ws,
    workspace_name: "aurinkokello",
    entry: name,
    name,
    path: `~/src/aurinkokello__worktrees/${name}`,
    state,
    branch: name.replace(/^wt-/, "wt/"),
    base: "main",
    changed: 0,
    untracked: 0,
    ignored: 0,
    ignored_paths: [],
    unreachable_head: false,
    size_bytes: 445 * MiB,
    size_complete: true,
    blockers:
      owner.state === "ended"
        ? []
        : [{ kind: "taskfleet_run", run_id: owner.run_id }],
    owner,
    actions: owner.state === "ended" ? ["remove"] : [],
    observation_token: `wt_${String(++n).padStart(24, "A")}`,
    ...over,
  });
  return {
    schema_version: 1,
    state: "listed",
    workspace_id: ws,
    worktrees: [
      wt(
        "wt-ej30796brt-r69-wtlist",
        "dirty",
        {
          run_id: "01m6y6gz4t8962hvej30796brt",
          role: "worker",
          title: "Worktree-listan prototyyppi",
          state: "working",
          conversation_id: live,
        },
        { changed: 4, ahead: 2, size_bytes: 452 * MiB },
      ),
      wt(
        "wt-vwek5m102j-testi-interaktiivinen-odottaa",
        "unmerged",
        {
          run_id: "01m6y3dvjm9a5e9evwek5m102j",
          role: "worker",
          title: "Testi: interaktiivinen odottaa",
          state: "waiting",
          conversation_id: archived,
        },
        { ahead: 1 },
      ),
      wt(
        "wt-wn4g5vgp8d-testi-headless-p-ttyy-merge-m-tt",
        "unmerged",
        {
          run_id: "01m6y3dq2wz8x7c5wn4g5vgp8d",
          role: "ended",
          title: "Testi: headless päättyy merge-mättä",
          state: "ended",
          conversation_id: archived,
        },
        { ahead: 1 },
      ),
      wt("wt-d0qmfx5v37-testaaja", "merged", {
        run_id: "01m6y4rzfh5yk0j6d0qmfx5v37",
        role: "helper",
        name: "testaaja",
        state: "waiting",
        conversation_id: archived,
        releases_at: at(7 * 60 + 25),
      }),
      wt("wt-hw4ctnr0kf-testi-avustaja", "merged", {
        run_id: "01m6y3dkm0dhhfq5hw4ctnr0kf",
        role: "helper",
        name: "testi-avustaja",
        state: "waiting",
        conversation_id: archived,
        releases_at: at(2 * 60 + 50),
      }),
    ],
    truncated: false,
    complete: true,
    listing_token: "a".repeat(64),
  };
}

const browser = await chromium.launch({ headless: true });
async function open(width, theme, lang) {
  const phone = width <= 800;
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    // A tall phone viewport keeps the section clear of the inner scroller.
    viewport: { width, height: phone ? 3200 : 900 },
    deviceScaleFactor: 2,
    isMobile: phone,
    hasTouch: phone,
    colorScheme: theme,
    locale: lang === "fi" ? "fi-FI" : "en-US",
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  await page.goto(`${origin}/workspaces`);
  await page.getByTestId("github-sign-in").click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
  await page.waitForURL(/\/workspaces/);
  const session = await (
    await page.request.get(`${origin}/auth/session`)
  ).json();
  await page.request.put(`${origin}/api/v1/account/preferences`, {
    headers: { Origin: origin, "X-Agent-Host-CSRF": session.csrf },
    data: { experimental: { "explain-mode": true } },
  });
  const state = await (
    await page.request.get(`${origin}/api/v1/snapshot`)
  ).json();
  const ws = state.workspaces.find(
    (w) => w.name === "aurinkokello",
  ).workspace_id;
  // The conversation of the trials is archived, as Jari's was.
  await page.route(`${origin}/api/v1/snapshot*`, async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    for (const a of body.agents ?? [])
      if (a.agent_id === archived) a.archive = "archived";
    await route.fulfill({ response, json: body });
  });
  await page.route(`${origin}/api/v1/workspaces`, async (route) => {
    const body = route.request().postDataJSON();
    if (body?.action !== "worktree_list") return route.continue();
    await route.fulfill({ json: listing(ws) });
  });
  await page.goto(`${origin}/workspaces/${ws}`);
  const section = page.getByTestId("worktrees");
  await section.getByTestId("worktree-attention").waitFor();
  await section.scrollIntoViewIfNeeded();
  await page.evaluate(() => document.fonts.ready);
  return { context, page, phone, section };
}

const region = '[data-testid="worktrees"]';
for (const lang of ["fi", "en"])
  for (const theme of ["light", "dark"])
    for (const width of [1440, 390]) {
      const { context, page, phone, section } = await open(width, theme, lang);
      const name = (step) => `${out}r-${lang}-${step}-${width}-${theme}`;
      const html = theme === "light" && lang === "fi" && !phone;
      try {
        await snapshot(page, name("0-default"), { region, html });
        const press = (l) => (phone ? l.tap() : l.click());
        await press(section.getByTestId("worktree-rest"));
        await press(section.getByTestId("worktree-git-toggle").nth(1));
        await page.waitForTimeout(200);
        await snapshot(page, name("1-open"), { region, html });
        if (theme === "light") {
          await press(section.getByTestId("worktree-remove"));
          const dialog = page.getByRole("dialog");
          await dialog.waitFor();
          await page.waitForTimeout(300);
          await page.screenshot({ path: `${name("2-remove")}.png` });
          await page.keyboard.press("Escape");
          await dialog.waitFor({ state: "detached" });
          // Explain mode: a row's card and the restore button's card, at
          // 1440 (on a phone the mode starts from the rail's drawer).
          if (phone) continue;
          // Selitä tämä näkymä is in the account menu, in the rail.
          await press(
            page.locator(".ah-rail").getByRole("button", { name: /Alice/ }),
          );
          await press(page.getByTestId("menu-explain"));
          await page.waitForTimeout(400);
          for (const [card, target] of [
            ["T16", section.locator(".ah-wt-row").first()],
            ["T19", section.getByTestId("worktree-restore-conversation")],
          ]) {
            await target.scrollIntoViewIfNeeded();
            if (phone) await target.tap();
            else {
              const box = await target.boundingBox();
              await page.mouse.move(
                box.x + Math.min(40, box.width / 2),
                box.y + Math.min(20, box.height / 2),
              );
            }
            await page.waitForTimeout(400);
            await page.screenshot({ path: `${name(`3-explain-${card}`)}.png` });
            if (phone) await page.keyboard.press("Escape");
          }
        }
      } finally {
        await context.close();
      }
    }
await browser.close();
