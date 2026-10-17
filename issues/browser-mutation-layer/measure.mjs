// Synthetic lab only: times the mutation layer's optimistic actions from the
// pointer press to the changed UI, at emulated latencies, and records which
// requests ran before the milestone (a snapshot read would show up here).
// Usage (repository root, lab running via scripts/lab.sh start):
//   PLAYWRIGHT_BROWSERS_PATH=$PWD/.cache/ms-playwright \
//     node issues/browser-mutation-layer/measure.mjs [--latency 0,100,200] [--runs 3]
// Summarise with issues/ui-responsiveness-review/summarize.mjs.
import { openLab, origin } from "../../web/lab/session.mjs";

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const latencies = opt("latency", "0,100,200").split(",").map(Number);
const runs = Number(opt("runs", "3"));

const RAIL = 'nav[aria-label="Työtilat ja keskustelut"]';

// In-page probe: t0 is the real pointerdown, each predicate is polled every
// animation frame, and fetch timings come from the Resource Timing buffer.
async function arm(page, predicates) {
  await page.evaluate((predicates) => {
    performance.clearResourceTimings();
    const state = { t0: undefined, hits: {}, firstMutation: undefined };
    window.__probe = state;
    const fns = Object.fromEntries(
      Object.entries(predicates).map(([k, src]) => [k, new Function(`return (${src})`)()]),
    );
    const start = () => {
      if (state.t0 !== undefined) return;
      state.t0 = performance.now();
      const mo = new MutationObserver(() => {
        if (state.firstMutation === undefined)
          state.firstMutation = performance.now() - state.t0;
        mo.disconnect();
      });
      mo.observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true });
      const tick = () => {
        const now = performance.now() - state.t0;
        for (const [k, fn] of Object.entries(fns))
          if (state.hits[k] === undefined) {
            try {
              if (fn()) state.hits[k] = now;
            } catch {}
          }
        if (Object.keys(state.hits).length < Object.keys(fns).length && now < 30000)
          requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };
    window.__probeStart = start;
    document.addEventListener("pointerdown", start, { capture: true, once: true });
    document.addEventListener("keydown", start, { capture: true, once: true });
  }, predicates);
}

async function collect(page, names, timeout = 30000) {
  await page
    .waitForFunction(
      (names) => names.every((n) => window.__probe?.hits[n] !== undefined),
      names,
      { timeout, polling: 50 },
    )
    .catch(() => {});
  return page.evaluate(() => {
    const p = window.__probe;
    const requests = performance
      .getEntriesByType("resource")
      .filter((e) => e.initiatorType === "fetch" && e.startTime >= p.t0 - 1)
      .map((e) => ({
        path: new URL(e.name).pathname.replace(/pi:[0-9a-f-]{36}/, "pi:…"),
        start: Math.round(e.startTime - p.t0),
        end: Math.round(e.responseEnd - p.t0),
      }));
    return {
      hits: Object.fromEntries(Object.entries(p.hits).map(([k, v]) => [k, Math.round(v)])),
      firstMutation: p.firstMutation === undefined ? null : Math.round(p.firstMutation),
      requests,
    };
  });
}

async function setLatency(cdp, latency) {
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false,
    latency,
    downloadThroughput: -1,
    uploadThroughput: -1,
  });
}

const settle = (page) => page.waitForTimeout(1500);
async function workspaceId(page, name) {
  const href = await page
    .locator(`${RAIL} a`, { hasText: new RegExp(`^${name}`) })
    .first()
    .getAttribute("href");
  return href.split("/").pop();
}

async function scenario(page) {
  const out = {};
  const id = await workspaceId(page, "muistiinpanot");
  await page.goto(`${origin}/workspaces/${id}`);
  await page.getByRole("button", { name: "Arkistoi työtila" }).waitFor();
  await settle(page);
  await arm(page, {
    rail_removed: `() => !document.querySelector('.ah-workspace a[href="/workspaces/${id}"]')`,
    notice: `() => [...document.querySelectorAll('[role=status]')].some(e => e.textContent.includes('Kumoa'))`,
  });
  await page.getByRole("button", { name: "Arkistoi työtila" }).click();
  out.workspace_archive = await collect(page, ["rail_removed", "notice"]);
  await settle(page);
  await arm(page, {
    rail_restored: `() => !!document.querySelector('.ah-workspace a[href="/workspaces/${id}"]')`,
  });
  await page.getByRole("button", { name: "Kumoa" }).click();
  out.workspace_undo = await collect(page, ["rail_restored"]);
  await settle(page);

  await page.getByRole("button", { name: "Muuta näyttönimeä…" }).first().click();
  const name = `Muistiot ${Date.now() % 100000}`;
  await page.getByLabel("Näyttönimi").fill(name);
  await arm(page, {
    dialog_closed: `() => !document.querySelector('[role=dialog]')`,
    rail_renamed: `() => [...document.querySelectorAll('${RAIL} a')].some(a => a.textContent.includes(${JSON.stringify(name)}))`,
  });
  await page.getByRole("dialog").getByRole("button", { name: "Tallenna" }).click();
  out.workspace_rename = await collect(page, ["dialog_closed", "rail_renamed"]);
  await settle(page);

  await page.goto(`${origin}/workspaces`);
  const card = page
    .locator(".ah-home-card")
    .filter({ has: page.locator("button[aria-label=Arkistoi]:not([disabled])") })
    .first();
  await card.waitFor({ timeout: 10000 });
  const title = (await card.locator(".ah-home-card-title").textContent()).trim();
  await settle(page);
  await arm(page, {
    card_removed: `() => ![...document.querySelectorAll('.ah-home-card-title')].some(e => e.textContent.trim() === ${JSON.stringify(title)})`,
    notice: `() => [...document.querySelectorAll('[role=status]')].some(e => e.textContent.includes('Arkistoitu'))`,
  });
  await card.locator("button[aria-label=Arkistoi]").click();
  out.card_archive = await collect(page, ["card_removed", "notice"]);
  await settle(page);
  await arm(page, {
    card_restored: `() => [...document.querySelectorAll('.ah-home-card-title')].some(e => e.textContent.trim() === ${JSON.stringify(title)})`,
  });
  await page.locator("[role=status]").getByRole("button", { name: "Palauta" }).click();
  out.card_restore = await collect(page, ["card_restored"]);
  return out;
}

for (const latency of latencies)
  for (let run = 1; run <= runs; run++) {
    const { page, browser } = await openLab({ width: 1440, height: 900 });
    try {
      const cdp = await page.context().newCDPSession(page);
      await setLatency(cdp, latency);
      const out = await scenario(page);
      for (const [action, r] of Object.entries(out))
        console.log(JSON.stringify({ action, latency, run, ...r }));
    } catch (e) {
      console.log(JSON.stringify({ latency, run, scenario: "all", error: String(e?.stack ?? e) }));
    } finally {
      await browser.close();
    }
  }
