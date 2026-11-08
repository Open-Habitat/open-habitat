// Synthetic lab only: evidence for issues/explain-coverage-audit. Start the
// lab in the same shell first (scripts/lab.sh start), then from the
// repository root, under timeout:
//   PLAYWRIGHT_BROWSERS_PATH=... node web/lab/explain-coverage-audit.mjs [map]
// Without arguments it captures the explain mode on the workspace front page
// at 1440 and 390 (device scale 2). With `map` it also paints a hit map: the
// card the mode shows at each sampled point, so a dead zone stands out.
import { chromium } from "@playwright/test";
import { origin, snapshot } from "./session.mjs";

const out = new URL(
  "../../issues/explain-coverage-audit/evidence/",
  import.meta.url,
).pathname;
const map = process.argv.includes("map");
const languages = process.argv.includes("en") ? ["fi", "en-US"] : ["fi"];
const browser = await chromium.launch({ headless: true });

async function open(width, language) {
  const phone = width <= 800;
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    viewport: { width, height: phone ? 844 : 900 },
    deviceScaleFactor: 2,
    isMobile: phone,
    hasTouch: phone,
    locale: "fi-FI",
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
  for (const data of [
    { language },
    { experimental: { "explain-mode": true } },
    { experimental: { "named-workers": true } },
  ])
    await page.request.put(`${origin}/api/v1/account/preferences`, {
      headers: { Origin: origin, "X-Agent-Host-CSRF": session.csrf },
      data,
    });
  const state = await (
    await page.request.get(`${origin}/api/v1/snapshot`)
  ).json();
  const ws = state.workspaces.find(
    (w) => w.name === "aurinkokello",
  ).workspace_id;
  await page.goto(`${origin}/workspaces/${ws}`);
  await page.getByTestId("conversation-start").first().waitFor();
  await page.waitForTimeout(1200);
  return { context, page, phone };
}

async function startMode(page, phone) {
  if (phone) {
    await page.getByTestId("navigation-open").tap();
    await page.getByTestId("account-menu-trigger").tap();
    await page.getByTestId("menu-explain").tap();
    // In the mode the first tap explains and the second closes the drawer.
    const close = page.locator('[data-testid="close-navigation"]:visible');
    await close.tap();
    await close.tap();
  } else {
    await page.getByTestId("account-menu-trigger").click();
    await page.getByTestId("menu-explain").click();
  }
  await page.getByTestId("explain-bar").waitFor();
  await page.waitForTimeout(400);
}

/** Moves the pointer over a grid on the main view and records which card
 * each point gets, then paints it as translucent cells, one colour per card,
 * red where nothing explains. */
async function hitMap(page, name) {
  const main = await page.locator("main, .ah-view-conversation").first();
  const box = await main.boundingBox();
  const step = 16;
  const cells = [];
  for (
    let y = Math.max(box.y, 40);
    y < Math.min(box.y + box.height, 900);
    y += step
  )
    for (let x = box.x; x < box.x + box.width; x += step) {
      await page.mouse.move(x + step / 2, y + step / 2);
      const id = await page
        .getByTestId("explain-card")
        .getAttribute("data-card", { timeout: 50 })
        .catch(() => null);
      const linger = await page
        .locator(".ah-explain-linger")
        .count()
        .catch(() => 0);
      cells.push({ x, y, id: linger ? null : id });
    }
  await page.evaluate(
    ({ cells, step }) => {
      const layer = document.createElement("div");
      layer.className = "ah-explain-ui";
      layer.id = "hitmap-layer";
      layer.style.cssText =
        "position:fixed;inset:0;pointer-events:none;z-index:99999";
      const hue = (id) =>
        [...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);
      for (const c of cells) {
        const d = document.createElement("div");
        d.style.cssText = `position:absolute;left:${c.x}px;top:${c.y}px;width:${step}px;height:${step}px;background:${c.id ? `hsla(${hue(c.id)},70%,55%,.35)` : "rgba(220,0,0,.45)"};font:8px monospace;color:#000`;
        d.textContent = c.id ?? "";
        layer.append(d);
      }
      document.body.append(layer);
    },
    { cells, step },
  );
  await page.screenshot({ path: `${out}${name}.png` });
}

for (const language of languages) {
  for (const width of map ? [1440] : [1440, 390]) {
    const { context, page, phone } = await open(width, language);
    const tag = language === "fi" ? "" : `-${language}`;
    await startMode(page, phone);
    if (map && !phone) {
      for (const [i, y] of [0, 760, 1520, 2280].entries()) {
        await page.evaluate((y) => {
          const s = document.querySelector(".ah-workspace-page");
          for (let n = s; n; n = n.parentElement)
            if (n.scrollHeight > n.clientHeight + 4) {
              n.scrollTop = y;
              break;
            }
        }, y);
        await page.waitForTimeout(300);
        await hitMap(page, `hitmap-workspace-${width}${tag}-${i}`);
        await page.evaluate(() =>
          document.querySelector("#hitmap-layer")?.remove(),
        );
      }
      await context.close();
      continue;
    }
    // The mode on the front page, at parts that had no card before.
    const shots = phone
      ? [
          ["workspace-icon-suggestion", "T29"],
          ["workspace-icon-picker", "T24"],
        ]
      : [
          ["workspace-icon-picker", "T24"],
          ["workspace-icon-suggestion", "T29"],
          ["workspace-icon-quick", "T32"],
        ];
    for (const [testId, card] of shots) {
      const target = page.getByTestId(testId).first();
      // Centred, clear of the mode's bar at the top.
      await target.evaluate((el) => el.scrollIntoView({ block: "center" }));
      if (phone) await target.tap();
      else await target.hover();
      await page
        .locator(`[data-testid="explain-card"][data-card="${card}"]`)
        .waitFor();
      await page.waitForTimeout(300);
      await snapshot(page, `${out}workspace-explain-${card}-${width}${tag}`);
      if (phone) await page.getByTestId("explain-close").tap();
    }
    await context.close();
  }
}
await browser.close();
console.log(`evidence in ${out}`);
