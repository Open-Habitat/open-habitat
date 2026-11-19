#!/usr/bin/env node
// The root README's images, from the synthetic lab's README story
// (test/browser-host/readme_story.go): an invented studio's English home for
// Alice, whose conversations this script starts through the browser and the
// fake Pi answers with scripted turns. Start a fresh lab for it, from the
// repository root:
//   BROWSER_HOST_LAB_STORY=readme BROWSER_HOST_VIEWS=1 \
//   BROWSER_HOST_EDITOR_DOMAIN=habitat.example.org \
//   BROWSER_HOST_EDITOR=1 BROWSER_HOST_CODE_SERVER=<code-server> \
//     scripts/lab.sh start
//   PLAYWRIGHT_BROWSERS_PATH="$PWD/.cache/ms-playwright" \
//     node web/lab/capture-readme.mjs <out-dir> [--website <dist>]
// lab.sh binds the lab to the shell that ran it, so run both in one shell.
// <code-server> is a real code-server binary, run read-only: an installed
// host's /opt/open-habitat/current/payloads/editor/runtime/bin/code-server
// will do. With it terminal-editor.png shows VS Code (Alice's settings in
// readme_story.go keep it light and free of first-run surfaces) beside the
// maximized browser terminal, cropped to the two; without the two editor
// variables it shows the built-in editor, terminal and conversation in a
// 1440 px window instead. The editor's stand-in (BROWSER_HOST_EDITOR=1
// alone) is refused. VS Code shows things the stand-in does not, so read
// that image at full size for strings that are not the story's. The run
// uses the story up (it starts every conversation once), so restart the lab
// before running it again. --website names a built website (`npm run
// build` in website/ makes website/dist) for people.png, the landing page's
// one-server diagram; without it that image is skipped. Each image is
// <name>.png beside its static HTML twin <name>.html (the whole page, where
// the image is a crop of it); hero.png is composed from hero-desktop and
// hero-phone. English, the light theme, device scale factor 2; the feature
// images come from a 1000 px desktop window so that their text stays legible
// at half the README's width. Synthetic lab only: never point this at a live
// host.
import { readFileSync } from "node:fs";
import { mkdir, readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import { snapshot } from "./session.mjs";

const args = process.argv.slice(2);
const outArg = args[0];
const websiteAt = args.indexOf("--website");
const website = websiteAt > 0 ? resolve(args[websiteAt + 1] ?? "") : "";
if (
  !outArg ||
  outArg.startsWith("--") ||
  (websiteAt > 0 && !args[websiteAt + 1])
) {
  console.error(
    "usage: node web/lab/capture-readme.mjs <out-dir> [--website <dist>]",
  );
  process.exit(2);
}
const out = resolve(outArg);
await mkdir(out, { recursive: true });

const port = readFileSync(
  fileURLToPath(new URL("../../.cache/lab/port", import.meta.url)),
  "utf8",
).trim();
if (!/^[0-9]+$/.test(port)) throw new Error("Invalid lab port");
// The story lab names itself as an installation would, on the standard
// port; the browser maps every name under the domain to the lab's listener.
const domain = "habitat.example.org";
const origin = `https://app.${domain}`;
const loopback = `https://127.0.0.1:${port}`;
const browser = await chromium.launch({
  headless: true,
  args: [`--host-resolver-rules=MAP *.${domain}:443 127.0.0.1:${port}`],
});
const feature = { width: 1000, height: 1000 };

async function fixture(page, path) {
  const res = await page.request.get(`${loopback}${path}`);
  if (res.status() >= 300) throw new Error(`${path}: ${res.status()}`);
  return res;
}

async function open({ width = 1280, height = 800, identity = "Alice" } = {}) {
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    viewport: { width, height },
    deviceScaleFactor: 2,
    locale: "en-US",
    colorScheme: "light",
    reducedMotion: "reduce",
  });
  await context.addInitScript(() => {
    localStorage.setItem("nah:theme", "light");
    localStorage.setItem("nah:language", "en");
  });
  const page = await context.newPage();
  await page.goto(`${origin}/workspaces`);
  await page.getByTestId("github-sign-in").click();
  await page.getByRole("link", { name: identity, exact: true }).click();
  await page.locator("main").waitFor();
  return page;
}

// The page as the lab gives it (PNG and HTML twin), then, with a box, the
// PNG replaced by that part of the viewport.
async function shot(page, name, box) {
  await page.waitForTimeout(500);
  await snapshot(page, join(out, name), { labOrigin: origin });
  if (box) await page.screenshot({ path: join(out, `${name}.png`), clip: box });
  console.log(`${name}.png`);
}

// The box around the given locators' union, padded and kept in the viewport.
async function around(page, locators, { pad = 16, x, width } = {}) {
  const boxes = [];
  for (const l of locators) {
    const b = await l.boundingBox();
    if (!b) throw new Error(`no box for ${l}`);
    boxes.push(b);
  }
  const view = page.viewportSize();
  const left = Math.max(0, x ?? Math.min(...boxes.map((b) => b.x)) - pad);
  const top = Math.max(0, Math.min(...boxes.map((b) => b.y)) - pad);
  const right = Math.min(
    view.width,
    width !== undefined
      ? left + width
      : Math.max(...boxes.map((b) => b.x + b.width)) + pad,
  );
  const bottom = Math.min(
    view.height,
    Math.max(...boxes.map((b) => b.y + b.height)) + pad,
  );
  return { x: left, y: top, width: right - left, height: bottom - top };
}

const send = (page) =>
  page.getByTestId("send").and(page.locator('[data-mode="send"]'));

// A new conversation in a workspace; the story's title model names it
// after its first turn, as the daemon names one.
async function start(page, workspace, prompt) {
  await page.goto(`${origin}/workspaces`);
  await page
    .getByRole("navigation")
    .getByTestId(`workspace-${workspace}`)
    .click();
  await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
  await say(page, prompt);
  await page.waitForURL(/conversation=pi:/);
  return new URL(page.url()).searchParams.get("conversation");
}

async function say(page, prompt) {
  await page.getByTestId("message-input").fill(prompt);
  await send(page).click();
}

async function idle(page, timeout = 60000) {
  await send(page).waitFor({ timeout });
}

async function named(page, title) {
  await page
    .getByTestId("conversation-title")
    .filter({ hasText: title })
    .waitFor({ timeout: 30000 });
}

async function visit(page, id) {
  await page.goto(`${origin}/agents/${id}`);
  await page.locator("main").waitFor();
  await page.waitForTimeout(1000);
}

// Opens every collapsed group of work steps in the latest agent turn.
async function showWork(page, turn) {
  for (const toggle of await turn.getByTestId("history-stage-toggle").all())
    if ((await toggle.getAttribute("aria-expanded")) !== "true")
      await toggle.click();
  const more = page.getByRole("button", { name: "Show work" });
  if (await more.count()) await more.last().click();
  await page.waitForTimeout(500);
}

const page = await open();
await fixture(page, "/fixture/pi-state?value=usable");
await fixture(page, "/fixture/story-hold?on=1");

// Two answered conversations wait for Alice: a website fix and a newsletter
// that asks her a question.
const websiteFix = await start(
  page,
  "website",
  "The contact page still shows the summer opening hours. Change them to the winter hours: Monday to Friday 10–17, Saturday 11–15, closed on Sundays.",
);
await idle(page);
const newsletter = await start(
  page,
  "newsletter",
  "Draft the November newsletter from the events in the team calendar, in the same style as the last one I sent.",
);
await idle(page);
// The handbook's agent hands its work to three workers; Alice has read its
// answer, so it waits on them under Running.
const handbook = await start(
  page,
  "staff-handbook",
  "Check every page of the staff handbook against the new travel and remote-work policy, and fix what is out of date. Split the work if it helps.",
);
await idle(page);
await named(page, "Handbook and the new policy");
await page.goto(`${origin}/workspaces`);
await visit(page, handbook);
// Two conversations at work, each named after its first, short turn.
const booking = await start(page, "room-booking", "What is in this folder?");
await idle(page);
await named(page, "Meeting room booking page");
await say(
  page,
  "Build a simple page where the team can book the meeting room, and keep it running on the server.",
);
const sales = await start(
  page,
  "sales-report",
  "Have October's sales files arrived in the data folder?",
);
await idle(page);
await named(page, "October sales report");
await say(
  page,
  "Make a short report of October sales from the spreadsheets in the data folder, with a chart, and show it to me.",
);
// The sales turn holds while its report script runs.
await page
  .getByText("Three regional files")
  .first()
  .waitFor({ timeout: 30000 });
await page.waitForTimeout(6000);
await page.getByRole("button", { name: "Show work" }).last().click();
await shot(page, "hero-desktop");
{
  const nav = page.getByRole("navigation").first();
  const yours = nav.getByText("Your turn", { exact: true }).first();
  const quiet = nav.getByText("Quiet", { exact: true }).first();
  const box = await around(page, [nav], { pad: 0 });
  const top = (await yours.boundingBox()).y - 14;
  const bottom = (await quiet.boundingBox()).y - 6;
  await shot(page, "your-turn", { ...box, y: top, height: bottom - top });
}

const phone = await open({ width: 390, height: 844 });
await visit(phone, sales);
await phone.getByRole("button", { name: "Show work" }).last().click();
await shot(phone, "hero-phone");
await phone.context().close();

// The same live turn in a 1000 px window, its steps open.
await page.setViewportSize({ width: feature.width, height: 1100 });
await visit(page, sales);
{
  const turn = page.getByTestId("agent-turn").last();
  await showWork(page, turn);
  const ask = page
    .getByTestId("message")
    .filter({ hasText: "Make a short report" })
    .last();
  await ask.scrollIntoViewIfNeeded();
  await page.evaluate(() => {
    const ask = [
      ...document.querySelectorAll('[data-testid="message"]'),
    ].findLast((m) => m.textContent.includes("Make a short report"));
    ask.scrollIntoView({ block: "start" });
  });
  await page.waitForTimeout(500);
  const timeline = page.getByTestId("conversation-timeline");
  const progress = page.getByTestId("turn-progress").last();
  const box = await around(page, [ask, progress, timeline.locator("xpath=.")], {
    pad: 20,
  });
  const askTop = (await ask.boundingBox()).y - 8;
  const p = await progress.boundingBox();
  const end = p.y + p.height + 12;
  await shot(page, "agent-at-work", {
    ...box,
    y: Math.max(60, askTop),
    height: end - Math.max(60, askTop),
  });
}

// Steering the booking agent while its tests run, and a queued follow-up.
await page.setViewportSize(feature);
await visit(page, booking);
await page
  .getByTestId("message-input")
  .fill("Make the slots 30 minutes instead of an hour.");
await page.getByTestId("message-input").press("Enter");
await page.waitForTimeout(800);
await page
  .getByTestId("message-input")
  .fill("When it runs, write a short note for the team on how to book.");
await page.getByTestId("message-input").press("Alt+Enter");
await page.waitForTimeout(1500);
{
  const build = page
    .getByTestId("message")
    .filter({ hasText: "Build a simple page" })
    .last();
  const composer = page.locator(".ah-cbox").last();
  const timeline = page.getByTestId("conversation-timeline");
  const b = await around(page, [build, composer, timeline], { pad: 16 });
  const top = Math.max(60, (await build.boundingBox()).y - 8);
  await shot(page, "steer", { ...b, y: top, height: b.y + b.height - top });
}

await fixture(page, "/fixture/story-hold?on=0");

// The finished report, offered as a view and opened beside the conversation.
await page.setViewportSize({ width: 1280, height: 800 });
await visit(page, sales);
await idle(page);
await page.getByTestId("close-navigation").click();
await fixture(page, `/fixture/story-view?target=${encodeURIComponent(sales)}`);
await page.getByTestId("view-offer").first().waitFor();
await page.getByTestId("view-offer").first().click();
await page.getByTestId("view-panel").waitFor();
await page.waitForTimeout(3000);
await shot(page, "view");
await page.getByTestId("navigation-open").first().click();

// The booking service, built and started: its steps open.
await page.setViewportSize({ width: feature.width, height: 1500 });
await visit(page, booking);
await idle(page, 90000);
{
  const build = page
    .getByTestId("message")
    .filter({ hasText: "Build a simple page" })
    .last();
  const turn = page.getByTestId("agent-turn").nth(1);
  for (const toggle of await turn.getByTestId("history-stage-toggle").all())
    await toggle.click();
  await page.waitForTimeout(800);
  // The process step stays closed: the lab has no process companion to
  // match it with, and its open card would say so.
  for (const step of ["python3 -m pytest -q", "curl -s localhost:8080/health"])
    await turn.getByRole("button").filter({ hasText: step }).first().click();
  await page.waitForTimeout(800);
  await page.evaluate(() => {
    const m = [...document.querySelectorAll('[data-testid="message"]')].find(
      (m) => m.textContent.includes("Build a simple page"),
    );
    m.scrollIntoView({ block: "start" });
  });
  await page.waitForTimeout(500);
  const timeline = page.getByTestId("conversation-timeline");
  const box = await around(page, [build, turn, timeline], { pad: 20 });
  const top = (await build.boundingBox()).y - 8;
  const turnBox = await turn.boundingBox();
  await shot(page, "build-on-top", {
    ...box,
    y: top,
    height: turnBox.y + turnBox.height + 8 - top,
  });
}

// The handbook's workers, the ended one opened.
await page.setViewportSize({ width: feature.width, height: 1000 });
await visit(page, handbook);
await page.getByTestId("background-spinoffs").click();
await page.waitForTimeout(1000);
const ended = page.getByRole("button", { name: /ended/ });
if (await ended.count()) await ended.first().click();
await page.waitForTimeout(1500);
{
  const reply = page.getByTestId("stage-reply").last();
  const strip = page.getByTestId("background-work");
  const timeline = page.getByTestId("conversation-timeline");
  const b = await around(page, [reply, strip, timeline], { pad: 14 });
  await shot(page, "workers", { ...b, y: Math.max(60, b.y) });
}

// Mail, calendar and files: the connected accounts.
await page.setViewportSize({ width: feature.width, height: 1500 });
await page.goto(`${origin}/settings/agent-data`);
await page.getByText("Connected accounts", { exact: true }).waitFor();
await page.waitForTimeout(3000);
{
  const label = page.getByText("Connected accounts", { exact: true });
  const google = page.getByText("alice@example.org", { exact: true }).first();
  const microsoft = page
    .getByText("alice@studio.example.org", { exact: true })
    .first();
  const main = page.locator("main");
  const m = await main.boundingBox();
  const l = await label.boundingBox();
  const g = await google.boundingBox();
  void g;
  const ms = await page
    .getByText("Outlook mail", { exact: true })
    .first()
    .boundingBox();
  void microsoft;
  const content = await around(page, [label], { pad: 0 });
  await shot(page, "connections", {
    x: content.x - 20,
    y: l.y - 20,
    width: Math.min(m.x + m.width, content.x + 760) - (content.x - 20),
    height: ms.y + ms.height + 40 - (l.y - 20),
  });
}

// The browser terminal and the editor beside the website conversation:
// VS Code where the lab runs a real code-server, else the built-in editor.
if (await editorOrigin(page)) await vscodeShot(page, websiteFix);
else await builtinEditorShot(page, websiteFix);

async function editorOrigin(page) {
  return await page.evaluate(
    async () => (await fetch("/api/v1/editor")).status === 200,
  );
}

async function csrfFetch(page, method, path, body) {
  return await page.evaluate(
    async ({ method, path, body }) => {
      const { csrf } = await (await fetch("/auth/session")).json();
      const r = await fetch(path, {
        method,
        headers: {
          "Content-Type": "application/json",
          "X-Agent-Host-CSRF": csrf,
        },
        body: JSON.stringify(body),
      });
      return r.status;
    },
    { method, path, body },
  );
}

// VS Code and the terminal, cropped to them: in a 1000 px window the
// conversation column holds the maximized terminal, and the explorer is
// narrowed so that the code keeps its width.
async function vscodeShot(page, conversation) {
  if (
    (await csrfFetch(page, "PUT", "/api/v1/account/preferences", {
      engine: "vscode",
    })) !== 200
  )
    throw new Error("could not choose VS Code");
  await page.evaluate(() =>
    localStorage.setItem("oh-editor-conversation-width", "360"),
  );
  await page.setViewportSize({ width: 1000, height: 680 });
  await visit(page, conversation);
  await page.getByRole("button").and(page.getByTestId("toggle-editor")).click();
  const vscode = page
    .frameLocator('[data-testid="workspace-editor"]')
    .frameLocator("#editor");
  await vscode
    .locator(".monaco-workbench, .fake-workbench")
    .first()
    .waitFor({ timeout: 90000 });
  if (!(await vscode.locator(".monaco-workbench").count()))
    throw new Error(
      "the lab's editor is the stand-in: set BROWSER_HOST_CODE_SERVER",
    );
  const workspace = await page.evaluate(
    async () =>
      (await (await fetch("/api/v1/snapshot")).json()).workspaces.find(
        (w) => w.name === "website",
      ).workspace_id,
  );
  if (
    (await csrfFetch(page, "POST", "/api/v1/editor/open", {
      workspace_id: workspace,
      path: "contact.html",
    })) !== 200
  )
    throw new Error("VS Code did not open contact.html");
  await vscode
    .locator(".tabs-container .tab")
    .filter({ hasText: "contact.html" })
    .waitFor();
  {
    const side = await vscode.locator(".part.sidebar").boundingBox();
    const code = await vscode.locator(".part.editor").boundingBox();
    await page.mouse.move(code.x - 2, side.y + 200);
    await page.mouse.down();
    await page.mouse.move(side.x + 150, side.y + 200, { steps: 8 });
    await page.mouse.up();
  }
  await page
    .getByRole("button")
    .and(page.getByTestId("toggle-terminal"))
    .click();
  await page.waitForTimeout(2500);
  // The maximized terminal has room for the change itself as well.
  await page.keyboard.type("git log --oneline\n");
  await page.waitForTimeout(800);
  await page.keyboard.type("git diff --stat HEAD~1\n");
  await page.waitForTimeout(1500);
  await page.getByTestId("maximize-terminal").click();
  await page.mouse.move(500, 679);
  await page.waitForTimeout(2000);
  const view = page.viewportSize();
  const left = (await page.getByTestId("workspace-editor").boundingBox()).x;
  await shot(page, "terminal-editor", {
    x: left,
    y: 0,
    width: view.width - left,
    height: view.height,
  });
}

async function builtinEditorShot(page, conversation) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await visit(page, conversation);
  await page.getByRole("button").and(page.getByTestId("toggle-editor")).click();
  await page
    .getByTestId("editor-file-entry")
    .and(page.locator('[data-path="contact.html"]'))
    .click();
  await page.getByTestId("editor-text-toggle").click();
  await page.getByTestId("editor-document").waitFor();
  await page
    .getByTestId("editor-file-picker")
    .getByRole("button", { name: "Close" })
    .click()
    .catch(() => {});
  await page
    .getByRole("button")
    .and(page.getByTestId("toggle-terminal"))
    .click();
  await page.waitForTimeout(2500);
  await page.keyboard.type("git log --oneline\n");
  await page.waitForTimeout(1500);
  await shot(page, "terminal-editor");
}

// Getting started, as Bob's first sign-in: the repositories step, then the
// AI account's sign-in link and code.
await fixture(page, "/fixture/scenario?value=pi-onboarding");
await fixture(page, "/fixture/pi-state?value=missing");
await fixture(page, "/fixture/pi-device-hold?value=on");
const bob = await open({ width: feature.width, height: 900, identity: "Bob" });
await bob
  .getByTestId("git-identity-confirm")
  .or(bob.getByTestId("git-identity-continue"))
  .click();
await bob.getByTestId("repository-chooser-title").waitFor();
await bob.waitForTimeout(1500);
// The onboarding column, from its address line to the step's own button.
async function column(page, last) {
  const head = await page
    .getByText("Open Habitat", { exact: true })
    .first()
    .boundingBox();
  const card = await page.getByTestId("onboarding-card").boundingBox();
  const end = await last.boundingBox();
  return {
    x: card.x - 24,
    y: head.y - 24,
    width: card.width + 48,
    height: end.y + end.height + 24 - (head.y - 24),
  };
}
await shot(
  bob,
  "first-use",
  await column(bob, bob.getByTestId("repository-proceed")),
);
await bob.getByTestId("repository-proceed").click();
await bob.getByTestId("pi-attempt-start").click();
await bob.getByText("ABCD-1234").waitFor();
await bob.waitForTimeout(1000);
await shot(
  bob,
  "ai-account",
  await column(
    bob,
    bob.getByText("No password is entered here", { exact: false }).first(),
  ),
);
await fixture(page, "/fixture/pi-device-hold?value=off");

// One server, a home per person: the website's landing diagram.
if (website) {
  const server = createServer(async (req, res) => {
    const path = normalize(
      join(website, decodeURIComponent(new URL(req.url, "http://x").pathname)),
    );
    if (!path.startsWith(website + sep) && path !== website) {
      res.writeHead(403).end();
      return;
    }
    const file =
      path.endsWith(sep) || extname(path) === ""
        ? join(path, "index.html")
        : path;
    try {
      const body = await readFile(file);
      const types = {
        ".html": "text/html",
        ".css": "text/css",
        ".js": "text/javascript",
        ".svg": "image/svg+xml",
        ".woff2": "font/woff2",
      };
      res
        .writeHead(200, {
          "content-type": types[extname(file)] ?? "application/octet-stream",
        })
        .end(body);
    } catch {
      res.writeHead(404).end();
    }
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const context = await browser.newContext({
    viewport: { width: 1200, height: 1000 },
    deviceScaleFactor: 2,
    colorScheme: "light",
  });
  const site = await context.newPage();
  await site.goto(`http://127.0.0.1:${server.address().port}/`);
  const figure = site.locator("figure.oh-server");
  await figure.waitFor();
  await site.evaluate(() => document.fonts.ready);
  await figure.screenshot({ path: join(out, "people.png") });
  console.log("people.png");
  await context.close();
  server.close();
}

// The hero: the desktop conversation with the phone composed into its corner.
{
  const image = async (name) =>
    `data:image/png;base64,${(await readFile(join(out, `${name}.png`))).toString("base64")}`;
  const context = await browser.newContext({
    viewport: { width: 1520, height: 960 },
    deviceScaleFactor: 2,
  });
  const canvas = await context.newPage();
  await canvas.setContent(`<!doctype html><html><body style="margin:0;background:#e8ece5">
<img src="${await image("hero-desktop")}" style="position:absolute;left:40px;top:40px;width:1280px;border-radius:14px;box-shadow:0 18px 50px rgba(30,45,35,.22),0 0 0 1px rgba(30,45,35,.12)">
<img src="${await image("hero-phone")}" style="position:absolute;right:40px;bottom:36px;width:300px;border-radius:30px;border:9px solid #1d2520;box-shadow:0 24px 60px rgba(20,30,25,.35)">
</body></html>`);
  await canvas.waitForTimeout(300);
  await canvas.screenshot({ path: join(out, "hero.png") });
  console.log("hero.png");
  await context.close();
}

console.log({ websiteFix, newsletter, handbook, booking, sales });
await browser.close();
