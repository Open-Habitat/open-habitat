#!/usr/bin/env node
// Synthetic lab only (implement-button-system): the screens the button system
// changes, in four presentations, plus keyboard focus in packed rows and at a
// scrolling container's top edge, and the computed size of every primitive.
//   node web/lab/capture-button-system.mjs <out-dir> <before|after>
// Writes <out>/<tag>-<screen>-<presentation>.{png,html}, focus crops
// <tag>-focus-<case>-<presentation>.png and <tag>-sizes.json.
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { openLab, origin, snapshot } from "./session.mjs";

const [outArg, tag] = process.argv.slice(2);
if (!outArg || !["before", "after"].includes(tag))
  throw new Error("usage: capture-button-system.mjs <out-dir> <before|after>");
const out = resolve(outArg);
if (
  !out.startsWith(`${resolve(".cache/lab")}/`) &&
  !out.startsWith(`${resolve("issues")}/`)
)
  throw new Error("Output must be under .cache/lab/ or issues/");
await mkdir(out, { recursive: true });

const presentations = [
  { id: "desktop-light", theme: "light", width: 1440, height: 900 },
  { id: "desktop-dark", theme: "dark", width: 1440, height: 900 },
  { id: "phone-light", theme: "light", width: 390, height: 844 },
  { id: "phone-dark", theme: "dark", width: 390, height: 844 },
];
const nav = (page) =>
  page.getByRole("navigation", { name: "Työtilat ja keskustelut" });
async function ready(page) {
  await page.waitForFunction(
    () => !document.body.innerText.includes("Haetaan työtilojasi"),
  );
  // Past the shell's entry fade.
  await page.waitForTimeout(1200);
}
async function settings(page, section) {
  await page.goto(`${origin}/settings`);
  await ready(page);
  await page.getByRole("button", { name: section, exact: true }).click();
  await page.waitForTimeout(700);
}
// The lab's fake Pi has no process extension; a synthetic inventory and
// spinoff read make the background strip appear (as capture-controls.mjs).
async function stripRoutes(page) {
  const now = Date.now();
  await page.route("**/api/v1/conversations/*/processes**", (route) =>
    route.fulfill({
      json: {
        schema_version: 1,
        owner_generation: "og_lab",
        availability: "available",
        unavailable_reason: null,
        interrupted: [],
        processes: [
          {
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
          },
        ],
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
let workspaceRoute;
async function conversation(page, phone) {
  await stripRoutes(page);
  await page.goto(`${origin}/workspaces`);
  await ready(page);
  if (phone)
    await page.getByRole("button", { name: "Avaa navigaatio" }).click();
  await nav(page)
    .getByRole("button", { name: "Uusi keskustelu työtilassa aurinkokello" })
    .click();
  const box = page.getByRole("textbox", { name: "Viesti Pi:lle" });
  await box.waitFor();
  await page.getByRole("region", { name: "Taustatyö" }).waitFor();
  await page.waitForTimeout(800);
}

const screens = [
  { id: "laitteet", setup: (page) => settings(page, "Laitteet") },
  { id: "tili", setup: (page) => settings(page, "Tili") },
  { id: "ulkoasu", setup: (page) => settings(page, "Ulkoasu") },
  {
    id: "workspace",
    async setup(page) {
      await page.goto(`${origin}${workspaceRoute}`);
      await ready(page);
    },
  },
  { id: "conversation", setup: conversation, region: ".ah-composer" },
  {
    id: "trash-dialog",
    async setup(page) {
      await page.goto(`${origin}${workspaceRoute}`);
      await ready(page);
      await page.getByRole("button", { name: "Poista työtila…" }).click();
      await page.getByRole("dialog").waitFor();
      await page.waitForTimeout(400);
    },
  },
];

// Focus cases: a packed row (neighbours close together) and the first control
// at a scrolling container's top edge.
const focusCases = [
  {
    id: "workspace-row",
    screen: "workspace",
    control: '.ah-workspace-icon-row [aria-label="Muuta näyttönimeä…"]',
    around: ".ah-workspace-icon-row",
  },
  {
    id: "theme-segments",
    screen: "ulkoasu",
    control: '[aria-label="Teema"] button >> nth=1',
    around: '[aria-label="Teema"]',
  },
  {
    id: "strip-pills",
    screen: "conversation",
    control: '[aria-label="Taustatyö"] button >> nth=1',
    around: '[aria-label="Taustatyö"]',
  },
  {
    id: "dialog-buttons",
    screen: "trash-dialog",
    control: '[role="dialog"] button >> nth=0',
    around: '[role="dialog"]',
  },
  {
    id: "rail-top-edge",
    screen: "workspace",
    desktopOnly: true,
    scroll: ".ah-rail-content",
  },
  {
    id: "strip-panel-top-edge",
    screen: "conversation",
    async prepare(page) {
      await page
        .getByRole("region", { name: "Taustatyö" })
        .getByRole("button", { name: /^Prosessit:/ })
        .click();
      await page.locator(".ah-bg-pop-body").first().waitFor();
    },
    scroll: ".ah-bg-pop-body",
  },
  {
    id: "settings-top-edge",
    screen: "laitteet",
    scroll: "main",
  },
];

// Every primitive on the page: role, size class, height and font.
function measure() {
  return [...document.querySelectorAll("[data-ah-primitive], button")]
    .filter((el) => el.getClientRects().length)
    .map((el) => {
      const s = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return {
        label: (el.getAttribute("aria-label") || el.innerText || "")
          .trim()
          .slice(0, 40),
        primitive: el.getAttribute("data-ah-primitive"),
        role: el.getAttribute("data-ah-size"),
        kind: el.getAttribute("data-ah-kind"),
        className: el.className.slice(0, 120),
        height: Math.round(r.height * 10) / 10,
        width: Math.round(r.width * 10) / 10,
        font: `${s.fontSize}/${s.fontWeight}`,
        radius: s.borderTopLeftRadius,
        outline: `${s.outlineWidth} ${s.outlineOffset}`,
      };
    });
}

const sizes = {};
const { browser, page } = await openLab();
page.setDefaultTimeout(10000);
try {
  workspaceRoute = await nav(page)
    .getByRole("link", { name: "aurinkokello", exact: true })
    .first()
    .getAttribute("href");
  for (const pres of presentations) {
    const phone = pres.width < 600;
    for (const screen of screens) {
      await page.request.get(`${origin}/fixture/daemon-restart`);
      await page.request.get(`${origin}/fixture/lab-conversations-clean`);
      await page.setViewportSize({ width: pres.width, height: pres.height });
      await page.goto(`${origin}/workspaces`);
      await page.evaluate(
        (t) => localStorage.setItem("nah:theme", t),
        pres.theme,
      );
      await screen.setup(page, phone);
      await page.mouse.move(0, 0);
      await snapshot(page, `${out}/${tag}-${screen.id}-${pres.id}`);
      sizes[`${screen.id}--${pres.id}`] = await page.evaluate(measure);
      for (const fc of focusCases.filter((f) => f.screen === screen.id)) {
        if (fc.desktopOnly && phone) continue;
        const file = `${out}/${tag}-focus-${fc.id}-${pres.id}.png`;
        try {
          let clip;
          const vp = page.viewportSize();
          const pad = 16;
          await fc.prepare?.(page);
          if (fc.scroll) {
            // The first control of a scrolling container sits at its top
            // edge, right under the row above it: the container must leave
            // room for its ring (Jari's observation in the prototype).
            const top = await page.evaluate((sel) => {
              const root = document.querySelector(sel);
              if (!root) return null;
              const scrolls = (el) =>
                /auto|scroll/.test(getComputedStyle(el).overflowY);
              let box = [root, ...root.querySelectorAll("*")].find(scrolls);
              for (let el = root; !box && el; el = el.parentElement)
                if (scrolls(el)) box = el;
              if (!box) return null;
              box.scrollTop = 0;
              const pick = [
                ...box.querySelectorAll(
                  "button:not([disabled]), a[href], summary, input",
                ),
              ].find((el) => el.getClientRects().length);
              if (!pick) return null;
              pick.setAttribute("data-bs-focus", "");
              const r = box.getBoundingClientRect();
              return { x: r.left, y: r.top, width: r.width };
            }, fc.scroll);
            if (!top) throw new Error("no scroll container");
            await page
              .locator("[data-bs-focus]")
              .evaluate((el) => el.focus({ focusVisible: true }));
            await page.waitForTimeout(200);
            const x = Math.max(0, top.x - pad);
            const y = Math.max(0, top.y - pad);
            clip = {
              x,
              y,
              width: Math.min(vp.width - x, top.width + 2 * pad),
              height: 140,
            };
          } else {
            await page
              .locator(fc.control)
              .first()
              .evaluate((el) => el.focus({ focusVisible: true }));
            await page.waitForTimeout(200);
            const box = await page.locator(fc.around).first().boundingBox();
            const x = Math.max(0, box.x - pad);
            const y = Math.max(0, box.y - pad);
            clip = {
              x,
              y,
              width: Math.min(vp.width - x, box.width + 2 * pad),
              height: Math.min(
                vp.height - y,
                Math.min(box.height, 260) + 2 * pad,
              ),
            };
          }
          await page.screenshot({ path: file, clip });
        } catch (error) {
          console.error(`${fc.id} ${pres.id}: ${String(error).slice(0, 200)}`);
        }
      }
      await page.unrouteAll();
    }
  }
  await writeFile(`${out}/${tag}-sizes.json`, JSON.stringify(sizes, null, 1));
} finally {
  await browser.close();
}
