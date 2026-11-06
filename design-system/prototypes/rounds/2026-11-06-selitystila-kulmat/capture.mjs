// Synthetic lab only. Captures today's views as production rendered them, at
// 1440 and 390 px, into ../../dist/selitystila-kulmat-capture/ (not committed):
// one inert body markup per view and width, the production stylesheet once.
// Round 7 adds the states a conversation is in after its start (working, its
// work shown, stopped, a failed turn, your turn, background work running) and
// the before/after pairs of the presses that keep working in the mode.
// build.mjs turns them into the round's page. The lab dies with the shell that
// started it, so start it in the same command:
//   OH_PORT_BASE=6174 scripts/lab.sh start && PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright \
//     node design-system/prototypes/rounds/2026-11-06-selitystila-kulmat/capture.mjs [view …]
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "../../../../web/node_modules/@playwright/test/index.mjs";
import { origin } from "../../../../web/lab/session.mjs";

const root = new URL("../../../../", import.meta.url).pathname;
const cap = `${root}design-system/prototypes/dist/selitystila-kulmat-capture/`;
mkdirSync(cap, { recursive: true });
const only = new Set(process.argv.slice(2));
const browser = await chromium.launch({ headless: true });
const fixture = async (page, q) => {
  const r = await page.request.get(`${origin}/fixture/${q}`);
  if (r.status() !== 204) throw new Error(`fixture ${q}: ${r.status()}`);
};

// The page as an inert twin: no scripts or frames, form values and scroll
// positions written into attributes, canvases as images. Never the live app.
async function markup(page) {
  return page.evaluate(async () => {
    // A rendered diagram is a blob: image that dies with the page.
    const blobs = new Map();
    for (const img of document.querySelectorAll('img[src^="blob:"]')) {
      const blob = await (await fetch(img.src)).blob();
      blobs.set(img.src, await new Promise((ok) => { const r = new FileReader(); r.onload = () => ok(r.result); r.readAsDataURL(blob); }));
    }
    const live = [...document.body.querySelectorAll("*")];
    const clone = document.body.cloneNode(true);
    const copies = [...clone.querySelectorAll("*")];
    live.forEach((src, i) => {
      const dst = copies[i];
      if (src instanceof HTMLInputElement) {
        if (src.type === "password" || src.type === "hidden") dst.removeAttribute("value");
        else dst.setAttribute("value", src.value);
        if (src.checked) dst.setAttribute("checked", "");
      }
      if (src instanceof HTMLTextAreaElement) dst.textContent = src.value;
      if (src instanceof HTMLDetailsElement) dst.open = src.open;
      if (src instanceof HTMLImageElement && blobs.has(src.src)) dst.setAttribute("src", blobs.get(src.src));
      if (src.scrollTop) dst.setAttribute("data-snapshot-scroll-top", String(Math.round(src.scrollTop)));
      if (src.scrollLeft) dst.setAttribute("data-snapshot-scroll-left", String(Math.round(src.scrollLeft)));
      if (src instanceof HTMLCanvasElement && src.width && src.height) {
        const img = document.createElement("img");
        try { img.src = src.toDataURL(); } catch { /* tainted: keep the box */ }
        img.setAttribute("style", `width:${src.getBoundingClientRect().width}px;height:${src.getBoundingClientRect().height}px`);
        img.className = src.className;
        dst.replaceWith(img);
      }
      if (src instanceof HTMLIFrameElement) {
        dst.removeAttribute("src");
        dst.setAttribute("data-snapshot-frame", "omitted");
      }
    });
    for (const el of [...clone.querySelectorAll("script, iframe, object, embed, link, meta, noscript")]) {
      if (el.tagName === "IFRAME") {
        const box = document.createElement("div");
        box.className = el.className;
        box.setAttribute("style", el.getAttribute("style") || "");
        box.setAttribute("data-snapshot-frame", "omitted");
        el.replaceWith(box);
      } else el.remove();
    }
    for (const el of clone.querySelectorAll("[data-hovered], [data-focus-visible], [data-focused]")) {
      el.removeAttribute("data-hovered");
      el.removeAttribute("data-focus-visible");
      el.removeAttribute("data-focused");
    }
    const h = document.documentElement;
    return { lang: h.lang, cls: h.className, theme: h.dataset.theme || "", body: clone.innerHTML, bodyCls: document.body.className };
  });
}

const views = [];
const view = (name, fn, widths = [1440, 390]) => views.push({ name, fn, widths });

async function signIn(page) {
  await page.goto(`${origin}/workspaces`);
  await page.getByTestId("github-sign-in").click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
  await page.waitForURL(/\/workspaces/);
  await page.waitForTimeout(800);
}
async function workspace(page, name = "aurinkokello") {
  const state = await (await page.request.get(`${origin}/api/v1/snapshot`)).json();
  return state.workspaces.find((w) => w.name === name).workspace_id;
}
const settle = (page, ms = 900) => page.waitForTimeout(ms);
const phoneOf = (page) => page.viewportSize().width <= 800;
async function viaMenu(page, testid, menuItem) {
  const button = page.getByTestId(testid);
  if (await button.isVisible()) return button.click();
  await page.getByTestId("conversation-menu").click();
  await page.getByTestId(menuItem).click();
}
async function conversation(page, ctx, prompt) {
  await page.goto(`${origin}/workspaces/${ctx.ws}`);
  await page.getByTestId("conversation-start").first().click();
  await page.getByTestId("message-input").fill(prompt);
  await page.getByTestId("send").and(page.locator('[data-mode="send"]')).click();
  await page.locator(".ah-feed > li[data-kind=assistant]").first().waitFor({ timeout: 20000 });
  await settle(page, 1500);
  return page.url();
}

// Etusivu: the rail and every workspace's open conversations.
view("etusivu", async (page) => { await page.goto(`${origin}/workspaces`); await settle(page); });
view("tyotila", async (page, ctx) => { await page.goto(`${origin}/workspaces/${ctx.ws}`); await settle(page, 1500); });
view("uusi", async (page, ctx) => {
  await page.goto(`${origin}/workspaces/${ctx.ws}`);
  await page.getByTestId("conversation-start").first().click();
  await page.getByTestId("start-here").waitFor();
  await settle(page, 1200);
  ctx.newUrl = page.url();
});
view("uusi-malli", async (page, ctx) => {
  await page.goto(ctx.newUrl);
  await page.getByTestId("composer-model-picker").click();
  await page.getByTestId("composer-model-menu").waitFor();
  await settle(page);
});
view("opas", async (page, ctx) => {
  await page.goto(ctx.newUrl);
  await page.getByTestId("starting-goal").first().click();
  await settle(page, 1200);
});
view("kaynnissa-tuloste", async (page, ctx) => {
  ctx.runUrl = await conversation(page, ctx, "näytä kortit taustaprosessi virhekortti tiedosto kaavio");
  await settle(page, 600);
  await ctx.save("kaynnissa");
  // The press that keeps working in the mode: "1 ajatus ja 3 työkalua" opens.
  await page.getByTestId("history-stage-toggle").first().click();
  await settle(page, 1200);
  await ctx.save("kaynnissa-auki");
  await page.locator('[data-testid="tool-row"][data-tool-name="bash"]:not([data-state="failed"])').first().click();
  await settle(page, 900);
});
view("valikko", async (page, ctx) => {
  await page.goto(ctx.runUrl);
  await page.getByTestId("message-input").waitFor();
  await settle(page);
  await page.getByTestId("conversation-menu").click();
  await page.getByRole("menu").waitFor();
  await settle(page, 500);
}, [390]);
view("komennot", async (page, ctx) => {
  await page.goto(ctx.runUrl);
  await page.getByTestId("command-palette").click();
  await settle(page, 1200);
});
view("tiedosto", async (page, ctx) => {
  await page.goto(ctx.runUrl);
  await page.getByTestId("file-picker").click();
  await settle(page, 1200);
});
view("malli", async (page, ctx) => {
  await page.goto(ctx.runUrl);
  await page.getByTestId("conversation-model").click();
  await settle(page);
});
view("git", async (page, ctx) => {
  await page.goto(ctx.runUrl);
  await page.getByTestId("git-chip").click();
  await settle(page);
});
view("tiedot", async (page, ctx) => {
  await page.goto(ctx.runUrl);
  await page.getByTestId("message-input").waitFor();
  await viaMenu(page, "workspace-details", "menu-details");
  await settle(page);
});
view("paate", async (page, ctx) => {
  await page.goto(ctx.runUrl);
  await page.getByTestId("toggle-terminal").click();
  await settle(page, 2500);
});
view("editori", async (page, ctx) => {
  await page.goto(ctx.runUrl);
  await page.getByTestId("toggle-editor").click();
  await settle(page, 3000);
});
view("pysaytetty", async (page, ctx) => {
  await conversation(page, ctx, "pitkä ajo");
  await page.getByTestId("message-input").fill("Tarkista myös kesäaika");
  await settle(page, 700);
  await ctx.save("tyossa");
  await page.getByTestId("turn-work-toggle").click();
  await settle(page, 600);
  await ctx.save("tyossa-tyo");
  await page.getByTestId("message-input").fill("");
  await page.getByTestId("composer-stop").click();
  await settle(page, 1500);
  // The work was shown while it ran; the stopped turn is read folded.
  const stage = page.getByTestId("history-stage-toggle").last();
  if ((await stage.getAttribute("aria-expanded")) === "true") await stage.click();
  await settle(page, 800);
});
view("virhe", async (page, ctx) => { await conversation(page, ctx, "virhevuoro"); });
view("sivupalkki", async (page, ctx) => {
  await page.goto(ctx.runUrl);
  await page.getByTestId("navigation-open").click();
  await settle(page);
}, [390]);
view("tilivalikko", async (page, ctx) => {
  await page.goto(ctx.runUrl);
  if (phoneOf(page)) await page.getByTestId("navigation-open").click();
  await page.getByTestId("account-menu-trigger").click();
  await settle(page);
});
view("hiljaiset", async (page, ctx) => {
  await page.goto(ctx.runUrl);
  if (phoneOf(page)) await page.getByTestId("navigation-open").click();
  await page.getByTestId("rail-quiet-menu").click();
  await settle(page);
});
view("asetukset", async (page) => { await page.goto(`${origin}/settings`); await settle(page, 1200); });
view("asetukset-tili", async (page) => { await page.goto(`${origin}/settings/tili`); await settle(page, 1200); }, [390]);
// Last: a worker of the running conversation exists from here on.
view("taustatyo", async (page, ctx) => {
  const parent = new URL(ctx.runUrl).searchParams.get("conversation").replace(/^pi:/, "");
  await fixture(page, `taskfleet?parent=${parent}&workspace=aurinkokello&harness=claude&status=running&history=ready`);
  await page.goto(ctx.runUrl);
  await settle(page, 2500);
  await page.getByTestId("background-spinoffs").click();
  await settle(page);
});
view("taustatyo-merkki", async (page, ctx) => {
  await page.goto(ctx.runUrl);
  await settle(page, 2500);
}, [1440, 390]);
view("worker", async (page, ctx) => {
  await page.goto(`${ctx.runUrl}&spinoff=01m53wnktnxb4w2xgdd79a66de`);
  await settle(page, 2500);
});

let wroteCss = false;
for (const width of [1440, 390]) {
  const phone = width <= 800;
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    viewport: { width, height: phone ? 844 : 900 },
    deviceScaleFactor: 1,
    isMobile: phone,
    hasTouch: phone,
    colorScheme: "light",
    locale: "fi-FI",
  });
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  await fixture(page, "scenario?value=ready");
  await fixture(page, "conversations-reset");
  await signIn(page);
  const ctx = { ws: await workspace(page) };
  // A view that passes through other states saves them on the way.
  ctx.save = async (name) => {
    await page.evaluate(() => document.fonts.ready);
    writeFileSync(`${cap}${name}-${width}.json`, JSON.stringify(await markup(page)));
    console.log(`${name}-${width}`);
  };
  for (const v of views) {
    if (!v.widths.includes(width)) continue;
    if (only.size && !only.has(v.name) && !["uusi", "kaynnissa-tuloste"].includes(v.name)) continue;
    try {
      await v.fn(page, ctx);
      await page.evaluate(() => document.fonts.ready);
      writeFileSync(`${cap}${v.name}-${width}.json`, JSON.stringify(await markup(page)));
      console.log(`${v.name}-${width}`);
    } catch (error) {
      console.log(`FAIL ${v.name}-${width}: ${error.message.split("\n")[0]}`);
    }
    // Esc also stops the long turn of "tyossa" (Esc in the field stops the agent).
    await page.keyboard.press("Escape").catch(() => {});
  }
  if (!wroteCss) {
    const css = await page.evaluate(() =>
      [...document.styleSheets].map((s) => { try { return [...s.cssRules].map((r) => r.cssText).join("\n"); } catch { return ""; } }).join("\n"));
    writeFileSync(`${cap}production.css`, css);
    wroteCss = true;
  }
  await context.close();
}
await browser.close();
