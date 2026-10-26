// Synthetic production UI evidence for sidebar-now-aakkoset, at device scale
// factor 2. Run from the repository root against a running lab:
//   PLAYWRIGHT_BROWSERS_PATH="$HOME/.cache/ms-playwright" node web/lab/capture-sidebar-now-aakkoset.mjs
// The lab's histories are terminal sessions that have ended, so the snapshot
// is rewritten on the wire to give them live states and to add invented
// workspaces; one unread reply is real (a second tab sends a message).
import { chromium, expect } from "@playwright/test";
import { origin, snapshot } from "./session.mjs";

const out = "issues/sidebar-now-aakkoset/evidence";
const id = (name) => `ws_${name.replace(/[^A-Za-z0-9]/g, "").padEnd(10, "0")}`;
const extra = [
  "budjetti-2027",
  "dotfiles",
  "mokki-varaukset",
  "opinnaytetyo",
  "sauna-anturit",
  "valokuvat-skriptit",
];
const hidden = ["vanha-blogi", "kesatyo-2024"];
const synthetic = [
  {
    agent_id: "pi:00000000-0000-4000-8000-0000000000a1",
    workspace: "budjetti-2027",
    title: "Lokakuun kuukausiraportti",
    run_active: true,
  },
  {
    agent_id: "pi:00000000-0000-4000-8000-0000000000a2",
    workspace: "mokki-varaukset",
    title: "Kalenterin synkronointi",
    run_active: false,
  },
];
function rewrite(body) {
  const template = body.workspaces.find((w) => w.name === "tilastoharjoitus");
  for (const name of [...extra, ...hidden])
    body.workspaces.push({
      ...template,
      workspace_id: id(name),
      name,
      display_name: name,
      visibility: hidden.includes(name) ? "hidden" : "visible",
      worktrees: undefined,
    });
  const template_agent = body.agents[0];
  for (const a of synthetic)
    body.agents.push({
      ...template_agent,
      agent_id: a.agent_id,
      workspace_id: id(a.workspace),
      title: { ...template_agent.title, display: a.title },
      process: "terminal_observed_live",
      run_active: a.run_active,
      waiting_on: [],
      pending_question: null,
    });
  for (const agent of body.agents) {
    const short = agent.agent_id.slice(3, 11);
    if (short === "a1a1a1a1" && agent.agent_id.endsWith("1")) {
      agent.process = "terminal_observed_live";
      agent.run_active = true;
    }
    if (agent.agent_id.endsWith("a1a1a1a1-0000-4000-8000-000000000002")) {
      agent.process = "terminal_observed_live";
      agent.run_active = false;
      agent.waiting_on = [
        {
          process_id: "synthetic-wait",
          name: "Muistutusten sähköpostipohja",
          kind: "taskfleet_wait",
          run_ids: [],
        },
      ];
    }
    if (short === "b2b2b2b2") {
      agent.process = "terminal_observed_live";
      agent.run_active = false;
      agent.pending_question = {
        request_id: "synthetic-question",
        question_kind: "select",
        prompt: "Käytetäänkö galleriassa WebP- vai AVIF-kuvia?",
        choices: ["WebP", "AVIF"],
      };
    }
    if (short === "c3c3c3c3") {
      agent.process = "terminal_observed_live";
      agent.run_active = false;
    }
  }
  return body;
}
async function settle(page) {
  await page.evaluate(() =>
    // The working dot pulses forever; wait only for finite transitions.
    Promise.allSettled(
      document
        .getAnimations()
        .filter((a) => a.effect?.getTiming().iterations !== Infinity)
        .map((a) => a.finished),
    ),
  );
  await page.evaluate(() => document.fonts.ready);
}
async function themed(page, name, region) {
  for (const theme of ["light", "dark"]) {
    await page.evaluate(
      (theme) => document.documentElement.setAttribute("data-theme", theme),
      theme,
    );
    await settle(page);
    await snapshot(page, `${out}/${name}-${theme}`, { html: false, region });
  }
}

const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();
  await page.route("**/api/v1/snapshot", async (route) => {
    const response = await route.fetch();
    await route.fulfill({ response, json: rewrite(await response.json()) });
  });
  await page.goto(`${origin}/workspaces`);
  await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
  await page.getByRole("link", { name: "Alice", exact: true }).click();
  const nav = page.getByTestId("workspace-navigation");
  await nav.waitFor().catch(async (e) => {
    await page.screenshot({ path: "/var/tmp/oh-cap/fail.png" });
    console.log(await page.locator("body").innerText());
    throw e;
  });
  // A real unread reply: another tab starts a conversation and sends.
  const writer = await context.newPage();
  await writer.goto(`${origin}/workspaces`);
  await writer
    .getByRole("navigation")
    .getByTestId("workspace-reseptikirja")
    .click();
  await writer.getByTestId(/^(new-conversation|conversation-start)$/).click();
  await expect(writer).toHaveURL(/conversation=pi(?:%3A|:)/);
  await expect(writer.getByTestId("message-input")).toBeEnabled();
  await writer
    .getByTestId("message-input")
    .fill("Lisää ostoslistan vienti tekstitiedostoksi.");
  await writer
    .getByTestId("send")
    .and(writer.locator('[data-mode="send"]'))
    .click();
  await expect(
    page.getByTestId("rail-yours").locator('[data-testid^="agent-item-"]'),
  ).toHaveCount(2, { timeout: 25000 });
  await writer.close();
  await page.bringToFront();
  // The unread reply lives in this tab's memory: no reload from here on.

  await themed(page, "desktop-home");
  await nav.getByTestId("workspace-aurinkokello").click();
  await page.locator("main h1").waitFor();
  await themed(page, "desktop-workspace");
  await nav.getByTestId("workspace-filter").fill("an");
  await themed(page, "desktop-filter", '[data-testid="workspace-navigation"]');
  await nav.getByTestId("clear-filter").click();
  await nav.getByTestId("close-navigation").click();
  await themed(page, "rail-narrow");
  await nav.getByTestId("navigation-open").click();

  await nav.getByTestId("home-link").click();
  await page.setViewportSize({ width: 390, height: 844 });
  await themed(page, "phone-toolbar");
  await page.getByTestId("navigation-open").click();
  await themed(page, "phone-drawer");
  await nav
    .locator(".ah-rail-content")
    .evaluate((el) => el.scrollTo(0, el.scrollHeight));
  await themed(page, "phone-drawer-workspaces");
} finally {
  await browser.close();
}
