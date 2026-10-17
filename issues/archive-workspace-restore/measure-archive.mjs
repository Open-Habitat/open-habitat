// Copy of ../ui-responsiveness-review/measure-actions.mjs with the archive labels
// and the rail's workspace list (not its Arkistoidut group) as the milestone.
// Synthetic lab only: times browser actions from the pointer press to a settled UI.
// Usage (repository root, lab running via scripts/lab.sh start):
//   PLAYWRIGHT_BROWSERS_PATH=$PWD/.cache/ms-playwright \
//     node issues/ui-responsiveness-review/measure-actions.mjs [--latency 0,100,200] [--runs 3]
// Latency is Chromium's per-request network emulation (added before each
// response), a model of the live Cloudflare -> Alder -> guest route, not a
// measurement of it. Results are printed as JSON lines.
import { openLab, origin } from "../../web/lab/session.mjs";

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const latencies = opt("latency", "0,200").split(",").map(Number);
const runs = Number(opt("runs", "3"));
const only = opt("only", "");

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

const scenarios = {
  // Workspace hide and its undo: the trigger case (icon row on the workspace page).
  async workspace_hide(page) {
    const id = await workspaceId(page, "muistiinpanot");
    await page.goto(`${origin}/workspaces/${id}`);
    await page.getByRole("button", { name: "Arkistoi työtila" }).waitFor();
    await settle(page);
    await arm(page, {
      button_disabled: `() => document.querySelector('[aria-label="Arkistoi työtila"]')?.disabled || document.querySelector('[aria-label="Arkistoi työtila"]')?.getAttribute('data-disabled') !== null && document.querySelector('[aria-label="Arkistoi työtila"]')?.hasAttribute('data-disabled')`,
      notice: `() => [...document.querySelectorAll('[role=status]')].some(e => e.textContent.includes('Tiedostot ja keskustelut säilyvät'))`,
      rail_removed: `() => !document.querySelector('${RAIL} .ah-workspace a[href="/workspaces/${id}"]')`,
    });
    await page.getByRole("button", { name: "Arkistoi työtila" }).click();
    const hide = await collect(page, ["notice", "rail_removed"]);
    await settle(page);
    await arm(page, {
      rail_restored: `() => !!document.querySelector('${RAIL} .ah-workspace a[href="/workspaces/${id}"]')`,
    });
    await page.getByRole("button", { name: "Kumoa" }).click();
    const undo = await collect(page, ["rail_restored"]);
    return { workspace_hide: hide, workspace_undo: undo };
  },

  async workspace_rename(page) {
    const id = await workspaceId(page, "(tilastoharjoitus|Tilastot)");
    await page.goto(`${origin}/workspaces/${id}`);
    await page.getByRole("button", { name: "Muuta näyttönimeä…" }).first().click();
    const name = `Tilastot ${Date.now() % 100000}`;
    await page.getByLabel("Näyttönimi").fill(name);
    await settle(page);
    await arm(page, {
      dialog_closed: `() => !document.querySelector('[role=dialog]')`,
      // The first rename annotates the directory and gives it a new workspace ID.
      rail_renamed: `() => [...document.querySelectorAll('${RAIL} a')].some(a => a.textContent.includes(${JSON.stringify(name)}))`,
    });
    await page.getByRole("dialog").getByRole("button", { name: "Tallenna" }).click();
    return { workspace_rename: await collect(page, ["dialog_closed", "rail_renamed"]) };
  },

  // Conversation archive from a home card (already has a local presentation mask).
  async card_archive(page) {
    await page.goto(`${origin}/workspaces`);
    const card = page.locator(".ah-home-card").filter({ has: page.locator("button[aria-label=Arkistoi]:not([disabled])") }).first();
    await card.waitFor({ timeout: 10000 });
    const title = (await card.locator(".ah-home-card-title").textContent()).trim();
    await settle(page);
    await arm(page, {
      card_removed: `() => ![...document.querySelectorAll('.ah-home-card-title')].some(e => e.textContent.trim() === ${JSON.stringify(title)})`,
      notice: `() => [...document.querySelectorAll('[role=status]')].some(e => e.textContent.includes('Arkistoitu'))`,
    });
    await card.locator("button[aria-label=Arkistoi]").click();
    const archive = await collect(page, ["card_removed", "notice"]);
    await settle(page);
    await arm(page, {
      card_restored: `() => [...document.querySelectorAll('.ah-home-card-title')].some(e => e.textContent.trim() === ${JSON.stringify(title)})`,
    });
    const restore = page.locator('[role=status]').getByRole("button", { name: "Palauta" });
    let restored = null;
    if (await restore.count()) {
      await restore.click();
      restored = await collect(page, ["card_restored"]);
    }
    return { card_archive: archive, card_restore: restored };
  },

  // + in the rail, then the first send in the new browser conversation.
  async create_and_send(page) {
    await page.goto(`${origin}/workspaces`);
    const plus = page.locator(RAIL).getByRole("button", { name: "Uusi keskustelu työtilassa muistiinpanot" });
    await plus.waitFor();
    await page.waitForFunction(() => {
      const b = document.querySelector('nav [aria-label="Uusi keskustelu työtilassa muistiinpanot"]');
      return b && !b.disabled && !b.hasAttribute("data-disabled");
    }, null, { timeout: 15000 });
    await settle(page);
    await arm(page, {
      route_pending: `() => location.search.includes('conversation=new')`,
      composer_ready: `() => { const t = document.querySelector('main textarea'); return t && !t.disabled && !t.readOnly && /conversation=pi:/.test(location.search); }`,
    });
    await plus.click();
    const create = await collect(page, ["route_pending", "composer_ready"]);
    const textarea = page.locator("main textarea").first();
    await textarea.fill("Mittausviesti: kerro lyhyesti mitä teet.");
    await settle(page);
    await arm(page, {
      user_text_visible: `() => [...document.querySelectorAll('main *')].some(e => e.children.length === 0 && e.textContent.includes('Mittausviesti: kerro'))`,
      composer_cleared: `() => document.querySelector('main textarea')?.value === ''`,
      turn_done: `() => !document.querySelector('[aria-label="Keskeytä"]') && !!document.querySelector('main textarea') && document.querySelector('main textarea').value === '' && performance.now() - window.__probe.t0 > 300`,
    });
    await page.getByRole("button", { name: "Lähetä", exact: true }).click();
    const send = await collect(page, ["user_text_visible", "composer_cleared", "turn_done"]);
    return { create_conversation: create, first_send: send };
  },
};

const results = [];
for (const latency of latencies)
  for (let run = 0; run < runs; run++)
    for (const [name, scenario] of Object.entries(scenarios)) {
      if (only && !only.split(",").includes(name)) continue;
      // A fresh lab session per scenario keeps fixture state from leaking between runs.
      const { browser, context, page } = await openLab();
      try {
        await page.locator(RAIL).waitFor();
        const cdp = await context.newCDPSession(page);
        await setLatency(cdp, latency);
        await page.goto(page.url());
        await page.locator(RAIL).waitFor();
        await settle(page);
        const out = await scenario(page);
        for (const [action, value] of Object.entries(out)) {
          const row = { latency, run, action, ...value };
          results.push(row);
          console.log(JSON.stringify(row));
        }
      } catch (error) {
        console.log(JSON.stringify({ latency, run, scenario: name, error: String(error).slice(0, 300) }));
      } finally {
        await browser.close();
      }
    }
