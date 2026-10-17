#!/usr/bin/env node
// Synthetic lab only (ui-control-audit): visit the production screens in the
// four presentations, find every button and button-like control, measure its
// computed geometry and focus ring, and crop it at rest and focused.
//   node web/lab/capture-controls.mjs [out-dir] [state-id]
// Writes <out>/controls.json and <out>/crops/*.png; build-control-catalogue.mjs
// turns them into the self-contained catalogue page.
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { origin, openLab } from "./session.mjs";

const out = resolve(process.argv[2] || ".cache/lab/controls");
const only = process.argv[3];
if (!out.startsWith(`${resolve(".cache/lab")}/`))
  throw new Error("Output must be under .cache/lab/");
await mkdir(`${out}/crops`, { recursive: true });

const presentations = [
  { id: "light-desktop", theme: "light", width: 1440, height: 900 },
  { id: "dark-desktop", theme: "dark", width: 1440, height: 900 },
  { id: "light-phone", theme: "light", width: 390, height: 844 },
  { id: "dark-phone", theme: "dark", width: 390, height: 844 },
];

const nav = (page) =>
  page.getByRole("navigation", { name: "Työtilat ja keskustelut" });
async function openDrawer(page, phone) {
  if (phone)
    await page.getByRole("button", { name: "Avaa navigaatio" }).click();
}
async function fixture(page, path) {
  const r = await page.request.get(`${origin}/fixture/${path}`);
  if (r.status() !== 204) throw new Error(`fixture ${path}: ${r.status()}`);
}
let routes;
async function ready(page) {
  await page.waitForFunction(
    () => !document.body.innerText.includes("Haetaan työtilojasi"),
  );
  await page.waitForTimeout(500);
}
async function newConversation(page, phone) {
  await page.goto(`${origin}/workspaces`);
  await ready(page);
  await openDrawer(page, phone);
  await nav(page)
    .getByRole("button", { name: "Uusi keskustelu työtilassa aurinkokello" })
    .click();
  await page.getByRole("textbox", { name: "Viesti Pi:lle" }).waitFor();
  await page.waitForTimeout(1000);
}
async function send(page, text) {
  await page.getByRole("textbox", { name: "Viesti Pi:lle" }).fill(text);
  const button = page.getByRole("button", { name: "Lähetä", exact: true });
  await page.waitForFunction(
    () => {
      const b = [...document.querySelectorAll("button")].find(
        (x) =>
          x.getAttribute("aria-label") === "Lähetä" ||
          x.innerText.trim() === "Lähetä",
      );
      return b && !b.disabled;
    },
    null,
    { timeout: 15000 },
  );
  await button.click();
}
// The lab's fake Pi has no process extension; a small synthetic inventory and
// spinoff read make the background strip appear (as capture-background-strip.mjs).
async function stripRoutes(page) {
  const now = Date.now();
  const proc = {
    id: "proc_7d40",
    name: "hidas-testi",
    command_preview: "python3 -m pytest tests/slow -q",
    process_token: "pt_proc_7d40",
    status: "running",
    started_at: now - 120000,
    ended_at: null,
    exit_code: null,
    signal: null,
    end_reason: null,
    wakes_agent: true,
    run_ids: [],
  };
  await page.route("**/api/v1/conversations/*/processes**", (route) =>
    route.fulfill({
      json: {
        schema_version: 1,
        owner_generation: "og_lab",
        availability: "available",
        unavailable_reason: null,
        interrupted: [],
        processes: [proc],
      },
    }),
  );
  await page.route("**/api/v1/agents/pi:*/spinoffs**", (route) =>
    route.fulfill({
      json: {
        schema_version: 1,
        parent_id: new URL(route.request().url()).pathname
          .split("/agents/")[1]
          .split("/spinoffs")[0],
        availability: "available",
        runs: [
          {
            run_id: "01m51m3q8z5c1rv7kd2tx6hnwe",
            title: "Testit aikavyöhykkeille",
            state: "working",
            created_at: new Date(now - 420000).toISOString(),
            summary: "",
            preserved: false,
            branch: "",
            worktree: "",
            source_branch: "main",
          },
        ],
        transcripts: [],
      },
    }),
  );
}

// Each state leaves the page showing the controls to catalogue.
const states = [
  {
    id: "sign-in",
    async setup(page) {
      await page.context().clearCookies();
      await page.goto(`${origin}/workspaces`);
      await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).waitFor();
    },
    async after(page) {
      await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
      await page.getByRole("link", { name: "Alice", exact: true }).click();
      await nav(page).waitFor();
    },
  },
  {
    id: "home",
    async setup(page) {
      await page.goto(`${origin}/workspaces`);
      await ready(page);
    },
  },
  {
    id: "nav-drawer",
    phoneOnly: true,
    async setup(page) {
      await page.goto(`${origin}/workspaces`);
      await ready(page);
      await openDrawer(page, true);
      await nav(page).waitFor();
    },
  },
  {
    id: "account-menu",
    async setup(page, phone) {
      await page.goto(`${origin}/workspaces`);
      await ready(page);
      await openDrawer(page, phone);
      await page.getByRole("button", { name: "Tilivalikko" }).click();
      await page.getByRole("menu").first().waitFor();
    },
  },
  {
    id: "workspace",
    async setup(page) {
      await page.goto(`${origin}${routes.workspace}`);
      await ready(page);
      await page.waitForTimeout(400);
    },
  },
  {
    id: "workspace-details",
    async setup(page) {
      await page.goto(`${origin}${routes.workspace}`);
      await ready(page);
      const s = page.locator(".ah-workspace-facts summary");
      if (await s.count()) await s.click();
      await page.waitForTimeout(300);
    },
  },
  {
    id: "history",
    async setup(page) {
      await page.goto(`${origin}${routes.history}`);
      await ready(page);
      await page.waitForTimeout(800);
    },
  },
  {
    id: "conversation",
    async setup(page, phone) {
      await newConversation(page, phone);
      await send(page, "Lue README ja kerro lyhyesti.");
      await page.waitForTimeout(2500);
    },
  },
  {
    id: "conversation-strip",
    async setup(page, phone) {
      await stripRoutes(page);
      await newConversation(page, phone);
      await page.getByRole("region", { name: "Taustatyö" }).waitFor();
      await page.waitForTimeout(800);
    },
    async after(page) {
      await page.unrouteAll();
    },
  },
  {
    id: "strip-open",
    async setup(page, phone) {
      await stripRoutes(page);
      await newConversation(page, phone);
      const strip = page.getByRole("region", { name: "Taustatyö" });
      await strip.getByRole("button", { name: /^Spinoffit:/ }).click();
      await page.waitForTimeout(500);
    },
    async after(page) {
      await page.unrouteAll();
    },
  },
  {
    id: "conversation-details",
    async setup(page, phone) {
      await newConversation(page, phone);
      const b = page.getByRole("button", { name: /Tiedot|avaa tiedot/ });
      if (await b.count()) await b.first().click();
      await page.waitForTimeout(400);
    },
  },
  ...[
    "Tili",
    "Laitteet",
    "Agentit",
    "Yhteydet",
    "Ulkoasu",
    "Tallennustila",
    "Palvelin",
    "Käyttäjät",
    "Levytila",
  ].map((section) => ({
    id: `settings-${section.toLowerCase().replace("ä", "a")}`,
    async setup(page) {
      await page.goto(`${origin}/settings`);
      await ready(page);
      await page.getByRole("button", { name: section, exact: true }).click();
      await page.waitForTimeout(700);
    },
  })),
  {
    id: "administration",
    async setup(page) {
      await page.goto(`${origin}/administration`);
      await ready(page);
      await page.waitForTimeout(600);
    },
  },
  ...["onboarding-git", "repo-chooser", "pi-start"].map((id) => ({
    id,
    async setup(page) {
      await fixture(page, "scenario?value=pi-onboarding");
      await fixture(page, "pi-state?value=missing");
      await page.context().clearCookies();
      await page.goto(`${origin}/workspaces`);
      await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
      await page.getByRole("link", { name: "Alice", exact: true }).click();
      const git = page.getByRole("button", {
        name: "Vahvista Git-identiteetti",
      });
      const onward = page.getByRole("button", { name: "Jatka repoihin" });
      const repos = page.getByRole("button", { name: "Jatka ilman repoja" });
      await git.or(onward).or(repos).first().waitFor();
      if (id === "onboarding-git") return;
      if (await git.count()) {
        await page
          .getByRole("textbox", { name: "Gitissä näkyvä nimi" })
          .fill("Alice Example");
        await git.click();
      }
      await onward.or(repos).first().waitFor();
      if (await onward.count()) await onward.click();
      await repos.waitFor();
      if (id === "pi-start") {
        await repos.click();
        await repos.waitFor({ state: "detached" });
        await page.waitForTimeout(1200);
      }
      await page.waitForTimeout(400);
    },
    async after(page) {
      await fixture(page, "scenario?value=ready");
      await fixture(page, "pi-state?value=usable").catch(() => {});
    },
  })),
];

const SELECTOR = [
  "button",
  "summary",
  "select",
  "a[href]",
  '[role="button"]',
  '[role="tab"]',
  '[role="menuitem"]',
  '[role="menuitemradio"]',
  '[role="radio"]',
  '[role="switch"]',
  '[role="option"]',
  'input[type="checkbox"]',
].join(",");

// Runs in the page: describe every visible control.
function describe(selector) {
  const px = (v) => Math.round(Number.parseFloat(v) * 10) / 10 || 0;
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 8 || r.height < 8) return false;
    const s = getComputedStyle(el);
    return s.visibility !== "hidden" && s.display !== "none" && +s.opacity > 0;
  };
  const textBox = (el) => {
    const range = document.createRange();
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const rects = [];
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (!n.textContent.trim()) continue;
      if (n.parentElement.closest("svg,kbd,.ah-badge,.ah-control-reason"))
        continue;
      range.selectNodeContents(n);
      for (const r of range.getClientRects()) if (r.width > 0) rects.push(r);
    }
    if (!rects.length) return null;
    const top = Math.min(...rects.map((r) => r.top));
    const bottom = Math.max(...rects.map((r) => r.bottom));
    const left = Math.min(...rects.map((r) => r.left));
    const right = Math.max(...rects.map((r) => r.right));
    return { top, bottom, left, right };
  };
  const out = [];
  const els = [...document.querySelectorAll(selector)].filter(visible);
  // A control nested in another control (a link in a menu item) is catalogued once.
  const set = new Set(els);
  for (const el of els) {
    let p = el.parentElement;
    let nested = false;
    while (p) {
      if (set.has(p)) nested = true;
      p = p.parentElement;
    }
    if (nested) continue;
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    const svg = el.querySelector("svg");
    const svgRect = svg?.getBoundingClientRect();
    const text = textBox(el);
    const name = (
      el.getAttribute("aria-label") ||
      el.innerText ||
      el.getAttribute("title") ||
      ""
    )
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 60);
    let icon = null;
    if (svgRect && svgRect.width > 0) {
      icon = { w: px(svgRect.width), h: px(svgRect.height) };
      if (text) {
        const iconMid = (svgRect.top + svgRect.bottom) / 2;
        const textMid = (text.top + text.bottom) / 2;
        icon.dy = px(iconMid - textMid);
        icon.gap =
          svgRect.right <= text.left
            ? px(text.left - svgRect.right)
            : svgRect.left >= text.right
              ? px(svgRect.left - text.right)
              : null;
      }
      icon.dyBox = px(
        (svgRect.top + svgRect.bottom) / 2 - (r.top + r.bottom) / 2,
      );
      icon.dxBox = text
        ? null
        : px((svgRect.left + svgRect.right) / 2 - (r.left + r.right) / 2);
    }
    const id = `c${out.length}`;
    el.setAttribute("data-audit-id", id);
    out.push({
      id,
      tag: el.tagName.toLowerCase(),
      role: el.getAttribute("role") || "",
      primitive: el.getAttribute("data-ah-primitive") || "",
      cls: (el.getAttribute("class") || "")
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 8)
        .join(" "),
      name,
      hasText: Boolean(text),
      disabled: el.matches(":disabled,[data-disabled],[aria-disabled=true]"),
      rect: {
        x: Math.round(r.x),
        y: Math.round(r.y),
        w: px(r.width),
        h: px(r.height),
      },
      style: {
        display: s.display,
        padding: `${px(s.paddingTop)} ${px(s.paddingRight)} ${px(s.paddingBottom)} ${px(s.paddingLeft)}`,
        radius: px(s.borderTopLeftRadius),
        font: `${px(s.fontSize)}/${s.fontWeight}`,
        bg: s.backgroundColor,
        fg: s.color,
        border: `${px(s.borderTopWidth)} ${s.borderTopStyle} ${s.borderTopColor}`,
        gap: s.columnGap,
        underline: s.textDecorationLine,
      },
      icon,
      ancestry: (() => {
        const names = [];
        for (
          let p = el.parentElement;
          p && names.length < 3;
          p = p.parentElement
        )
          for (const c of p.classList)
            if (
              c.startsWith("ah-") ||
              c.startsWith("dl-") ||
              c.startsWith("s-")
            ) {
              names.push(c);
              break;
            }
        return names.join(" < ");
      })(),
    });
  }
  return out;
}

// Runs in the page after focusing a control: is its ring visible?
function ringCheck(id) {
  const el = document.querySelector(`[data-audit-id="${id}"]`);
  if (!el) return null;
  const s = getComputedStyle(el);
  const ow = Number.parseFloat(s.outlineWidth) || 0;
  const oo = Number.parseFloat(s.outlineOffset) || 0;
  const ring = {
    focused: document.activeElement === el,
    color: s.outlineColor,
    outline:
      s.outlineStyle === "none"
        ? "none"
        : `${ow}px ${s.outlineStyle} ${s.outlineColor} +${oo}`,
    shadow: s.boxShadow === "none" ? "" : s.boxShadow.slice(0, 60),
    clippedBy: [],
  };
  if (s.outlineStyle === "none" || ow === 0) return ring;
  const r = el.getBoundingClientRect();
  const e = oo + ow;
  const outer = {
    top: r.top - e,
    bottom: r.bottom + e,
    left: r.left - e,
    right: r.right + e,
  };
  for (
    let p = el.parentElement;
    p && p !== document.body;
    p = p.parentElement
  ) {
    const ps = getComputedStyle(p);
    if (
      ps.overflowX === "visible" &&
      ps.overflowY === "visible" &&
      ps.clipPath === "none"
    )
      continue;
    const pr = p.getBoundingClientRect();
    const sides = [];
    if (ps.overflowY !== "visible" && outer.top < pr.top - 0.5)
      sides.push("top");
    if (ps.overflowY !== "visible" && outer.bottom > pr.bottom + 0.5)
      sides.push("bottom");
    if (ps.overflowX !== "visible" && outer.left < pr.left - 0.5)
      sides.push("left");
    if (ps.overflowX !== "visible" && outer.right > pr.right + 0.5)
      sides.push("right");
    if (sides.length)
      ring.clippedBy.push(
        `${p.tagName.toLowerCase()}.${[...p.classList].slice(0, 2).join(".")} (${sides.join(",")})`,
      );
  }
  ring.geom = {
    top: r.top,
    left: r.left,
    right: r.right,
    bottom: r.bottom,
    ow,
    oo,
  };
  return ring;
}

// How much of each side of the outline is actually on screen in the outline
// colour: a ring hidden by an overflow ancestor, a later positioned sibling or
// the viewport edge shows up here whatever the cause.
async function ringPixels(page, ring) {
  const { top, left, right, bottom, ow, oo } = ring.geom;
  const vp = page.viewportSize();
  const e = oo + ow;
  const x0 = Math.max(0, Math.floor(left - e - 2));
  const y0 = Math.max(0, Math.floor(top - e - 2));
  const x1 = Math.min(vp.width, Math.ceil(right + e + 2));
  const y1 = Math.min(vp.height, Math.ceil(bottom + e + 2));
  if (x1 - x0 < 4 || y1 - y0 < 4) return null;
  const png = await page.screenshot({
    clip: { x: x0, y: y0, width: x1 - x0, height: y1 - y0 },
  });
  return page.evaluate(
    async ({
      b64,
      x0,
      y0,
      top,
      left,
      right,
      bottom,
      ow,
      oo,
      color,
      vw,
      vh,
    }) => {
      const bin = Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0));
      const bmp = await createImageBitmap(
        new Blob([bin], { type: "image/png" }),
      );
      const cv = new OffscreenCanvas(bmp.width, bmp.height);
      const cx = cv.getContext("2d");
      cx.drawImage(bmp, 0, 0);
      const px = cx.getImageData(0, 0, bmp.width, bmp.height).data;
      const want = color.match(/[\d.]+/g).map(Number);
      const at = (x, y) => {
        // Outside the viewport counts as not visible.
        if (x < 0 || y < 0 || x >= vw || y >= vh) return false;
        const ix = Math.round(x - x0);
        const iy = Math.round(y - y0);
        if (ix < 0 || iy < 0 || ix >= bmp.width || iy >= bmp.height)
          return false;
        const i = (iy * bmp.width + ix) * 4;
        return (
          Math.abs(px[i] - want[0]) +
            Math.abs(px[i + 1] - want[1]) +
            Math.abs(px[i + 2] - want[2]) <
          60
        );
      };
      const d = oo + ow / 2;
      const res = {};
      const sample = (side, fn, from, to) => {
        let hit = 0;
        let n = 0;
        // Skip the rounded corners.
        for (let t = from + 10; t <= to - 10; t += 2) {
          n++;
          if (fn(t)) hit++;
        }
        res[side] = n ? Math.round((100 * hit) / n) : null;
      };
      sample(
        "top",
        (x) => at(x, top - d - 0.5) || at(x, top - d + 0.5),
        left,
        right,
      );
      sample(
        "bottom",
        (x) => at(x, bottom + d - 0.5) || at(x, bottom + d + 0.5),
        left,
        right,
      );
      sample(
        "left",
        (y) => at(left - d - 0.5, y) || at(left - d + 0.5, y),
        top,
        bottom,
      );
      sample(
        "right",
        (y) => at(right + d - 0.5, y) || at(right + d + 0.5, y),
        top,
        bottom,
      );
      return res;
    },
    {
      b64: png.toString("base64"),
      x0,
      y0,
      top,
      left,
      right,
      bottom,
      ow,
      oo,
      color: ring.color,
      vw: vp.width,
      vh: vp.height,
    },
  );
}

const result = {
  origin: "synthetic lab",
  captured: new Date().toISOString(),
  states: [],
  errors: [],
};
const { browser, page } = await openLab();
page.setDefaultTimeout(8000);
try {
  await fixture(page, "lab-marker");
  routes = {
    workspace: await nav(page)
      .getByRole("link", { name: "aurinkokello", exact: true })
      .first()
      .getAttribute("href"),
    history: await nav(page)
      .locator('a[href^="/agents/"]')
      .first()
      .getAttribute("href"),
  };
  for (const state of states.filter(
    (s) => !only || only.split(",").includes(s.id),
  ))
    for (const pres of presentations) {
      const phone = pres.width < 600;
      if (state.phoneOnly && !phone) continue;
      const key = `${state.id}--${pres.id}`;
      try {
        // Start from the seeded lab: no earlier capture conversations or their Pi.
        await page.request.get(`${origin}/fixture/daemon-restart`);
        await page.request.get(`${origin}/fixture/lab-conversations-clean`);
        await page.setViewportSize({ width: pres.width, height: pres.height });
        await page.goto(`${origin}/workspaces`);
        await page.evaluate(
          (t) => localStorage.setItem("nah:theme", t),
          pres.theme,
        );
        await state.setup(page, phone);
        await page.evaluate(() => document.fonts.ready);
        await page.mouse.move(0, 0);
        const controls = await page.evaluate(describe, SELECTOR);
        await page.screenshot({
          path: `${out}/crops/${key}--page.png`,
          fullPage: false,
        });
        for (const c of controls) {
          const loc = page.locator(`[data-audit-id="${c.id}"]`);
          const clip = async (suffix) => {
            const box = await loc.boundingBox();
            if (!box) return null;
            const vp = page.viewportSize();
            const x = Math.max(0, box.x - 10);
            const y = Math.max(0, box.y - 10);
            const w = Math.min(vp.width - x, box.width + 20);
            const h = Math.min(vp.height - y, box.height + 20);
            if (w < 4 || h < 4 || box.y > vp.height || box.y + box.height < 0)
              return null;
            const file = `${key}--${c.id}${suffix}.png`;
            await page.screenshot({
              path: `${out}/crops/${file}`,
              clip: { x, y, width: w, height: h },
            });
            return file;
          };
          try {
            await loc.scrollIntoViewIfNeeded({ timeout: 1000 });
            await loc.evaluate((el) =>
              el.scrollIntoView({ block: "center", inline: "nearest" }),
            );
            c.crop = await clip("");
            // Keyboard-style focus so :focus-visible applies.
            await loc.evaluate((el) => el.focus({ focusVisible: true }));
            c.ring = await page.evaluate(ringCheck, c.id);
            if (c.ring?.geom) c.ring.visible = await ringPixels(page, c.ring);
            if (c.ring) delete c.ring.geom;
            c.focusCrop = await clip("-focus");
            await loc.evaluate((el) => el.blur());
          } catch (error) {
            c.error = String(error).slice(0, 160);
          }
        }
        result.states.push({
          key,
          state: state.id,
          presentation: pres.id,
          controls,
        });
        console.log(`${key}: ${controls.length}`);
      } catch (error) {
        result.errors.push({ key, error: String(error).slice(0, 300) });
        console.log(`${key}: ERROR ${String(error).slice(0, 200)}`);
      } finally {
        await page.keyboard.press("Escape").catch(() => {});
        await state
          .after?.(page)
          .catch((e) => console.log(`after ${key}: ${e}`));
      }
    }
} finally {
  await browser.close();
  if (only) {
    // A partial run replaces only its own states in an earlier capture.
    try {
      const { readFile } = await import("node:fs/promises");
      const prev = JSON.parse(await readFile(`${out}/controls.json`, "utf8"));
      const ids = new Set(
        result.states.map((s) => s.state).concat(only.split(",")),
      );
      result.states = prev.states
        .filter((s) => !ids.has(s.state))
        .concat(result.states);
      result.errors = prev.errors
        .filter((e) => !ids.has(e.key.split("--")[0]))
        .concat(result.errors);
    } catch {}
  }
  await writeFile(
    `${out}/controls.json`,
    `${JSON.stringify(result, null, 1)}\n`,
  );
}
