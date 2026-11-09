import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Page } from "@playwright/test";
import type { Spinoffs } from "../src/app/spinoffs";
import { labOrigin } from "../test-ports.mjs";
import { type Control, controls } from "./explain-coverage";
import { expect, test } from "./lab-host";

// Explain-mode coverage: every control a view shows has a card in the mode,
// its own or its region's, or a reason here why it has none. A new chip or
// button that ships without a card fails its view. Wording is never read:
// controls are found by role and tag, cards by their parts' selectors.
test.use({
  baseURL: labOrigin,
  ignoreHTTPSErrors: true,
  reducedMotion: "reduce",
});

const inventory = process.env.OH_EXPLAIN_INVENTORY;
const paths: Record<string, string> = JSON.parse(
  readFileSync(
    new URL("../../internal/uiroutes/settings.json", import.meta.url),
    "utf8",
  ),
);

async function survey(page: Page, view: string) {
  await page.waitForTimeout(300);
  const found = await controls(page);
  const width = page.viewportSize()?.width;
  if (inventory) {
    mkdirSync(inventory, { recursive: true });
    writeFileSync(
      resolve(inventory, `${view}-${width}.json`),
      JSON.stringify(found, null, 1),
    );
    writeFileSync(
      resolve(inventory, `marks-${view}-${width}.json`),
      JSON.stringify(await controls(page, { marks: true }), null, 1),
    );
    return;
  }
  const missing = found.filter((c) => !c.card && !c.allowed);
  expect(
    missing.map((c: Control) => `${c.where} (${c.path})`),
    `${view} at ${width}: controls without a card`,
  ).toEqual([]);
}

async function signIn(page: Page) {
  expect(
    (await page.request.get("/fixture/conversations-reset")).status(),
  ).toBe(204);
  await page.goto("/workspaces");
  await page.getByTestId("github-sign-in").click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
  const session = await (await page.request.get("/auth/session")).json();
  for (const data of [
    { experimental: { "explain-mode": true } },
    { experimental: { "named-workers": true } },
    { experimental: { "remote-browser": true } },
  ])
    expect(
      (
        await page.request.put("/api/v1/account/preferences", {
          headers: {
            Origin: new URL(page.url()).origin,
            "X-Agent-Host-CSRF": session.csrf,
          },
          data,
        })
      ).ok(),
    ).toBe(true);
  await page.reload();
}

async function workspace(page: Page, name = "aurinkokello") {
  const state = await (await page.request.get("/api/v1/snapshot")).json();
  const ws = state.workspaces.find(
    (w: { name: string }) => w.name === name,
  ).workspace_id;
  await page.goto(`/workspaces/${ws}`);
  await expect(page.getByTestId("conversation-start").first()).toBeVisible();
}

async function newConversation(page: Page) {
  await workspace(page);
  await page.getByTestId("conversation-start").first().click();
  await expect(page.getByTestId("start-here")).toBeVisible();
}

async function answered(page: Page) {
  await newConversation(page);
  await page
    .getByTestId("message-input")
    .fill("näytä kortit taustaprosessi virhekortti tiedosto kaavio");
  await page
    .getByTestId("send")
    .and(page.locator('[data-mode="send"]'))
    .click();
  await expect(page.getByTestId("history-stage-toggle").last()).toBeVisible({
    timeout: 20000,
  });
}

const ago = (min: number) => new Date(Date.now() - min * 60000).toISOString();
const run = {
  summary: "",
  preserved: false,
  branch: "",
  worktree: "",
  source_branch: "main",
  harness: "pi" as const,
};
const workers: Spinoffs["runs"] = [
  {
    ...run,
    run_id: "01m6y7rab7b1tkjeq0xwd05001",
    title: "Kastelun ajastus",
    created_at: ago(18),
    state: "working",
    profile: "oletus",
  },
  {
    ...run,
    run_id: "01m6y7rab7b1tkjeq0xwd05002",
    title: "Kasvilajien tuonti",
    created_at: ago(80),
    ended_at: ago(50),
    state: "unmerged",
    preserved: true,
    branch: "wt/kasvilajien-tuonti",
    profile: "oletus",
  },
  {
    ...run,
    run_id: "01m6y7rab7b1tkjeq0xwd05003",
    title: "Ulkoasun katselmointi",
    created_at: ago(30),
    state: "waiting_parent",
    branch: "layout-review",
    resident: {
      name: "layout-review",
      round_state: "waiting",
      rounds: 1,
      landed_round: 1,
      report: "Ulkoasu katselmoitu",
      reported_at: ago(5),
    },
  },
];

async function routeWorkers(page: Page) {
  await page.route("**/api/v1/agents/pi:*/spinoffs**", (route) => {
    const url = new URL(route.request().url());
    const only = url.searchParams.get("run");
    return route.fulfill({
      json: {
        schema_version: 1,
        parent_id: url.pathname.split("/agents/")[1].split("/spinoffs")[0],
        availability: "available",
        runs: only ? workers.filter((r) => r.run_id === only) : workers,
        transcripts: [],
      },
    });
  });
}

for (const width of [1440, 390]) {
  const phone = width < 800;
  test.describe(`at ${width}`, () => {
    test.use({
      viewport: { width, height: phone ? 844 : 900 },
      hasTouch: phone,
      isMobile: phone,
    });

    test(`@lab explain cards cover home and navigation at ${width}`, async ({
      page,
    }) => {
      await signIn(page);
      await page.goto("/workspaces");
      await expect(page.getByTestId("workspaces-title")).toBeVisible();
      await survey(page, "home");
      if (phone) {
        // On a phone the rail and the account menu are in the drawer.
        await page.getByTestId("navigation-open").click();
        await survey(page, "home-navigation");
      }
      await page.getByTestId("account-menu-trigger").click();
      await survey(page, "account-menu");
      if (phone) {
        // Started from the drawer, the mode's bar leaves the drawer's head
        // and its close in reach.
        await page.getByTestId("menu-explain").click();
        const bar = await page.getByTestId("explain-bar").boundingBox();
        const close = await page
          .locator('[data-testid="close-navigation"]:visible')
          .boundingBox();
        expect(bar && close).toBeTruthy();
        if (bar && close)
          expect(close.y).toBeGreaterThanOrEqual(bar.y + bar.height);
      }
      await page.keyboard.press("Escape");
      await page.goto("/workspaces/new");
      await survey(page, "new-workspace");
      await page.locator('[data-testid^="repository-option-"]').first().click();
      await expect(page.getByTestId("repository-clone")).toBeVisible();
      await survey(page, "new-workspace-repository");
      await page.goto("/workspaces/new?source=directory");
      await expect(page.getByTestId("directory-name")).toBeVisible();
      await survey(page, "new-workspace-directory");
    });

    test(`@lab explain cards cover the workspace front page at ${width}`, async ({
      page,
    }) => {
      test.setTimeout(60000);
      await signIn(page);
      await workspace(page);
      await survey(page, "workspace");
      await page.getByTestId("rename-workspace").click();
      await survey(page, "workspace-rename");
      await page.keyboard.press("Escape");
      await page.getByTestId("delete-workspace").click();
      await survey(page, "workspace-delete");
      await page.keyboard.press("Escape");
      for (const opener of ["workspace-icon-picker", "workspace-git"]) {
        await page.getByTestId(opener).click();
        await survey(page, opener);
        await page.keyboard.press("Escape");
      }
      for (const fold of await page
        .locator(
          ".ah-workspace-done > summary, .ah-workspace-archive > summary",
        )
        .all())
        await fold.click();
      await survey(page, "workspace-folds");
      // An archived conversation opens to read, its foot in the composer's place.
      await page
        .getByTestId("workspace-archive-panel")
        .getByTestId("archive-row-open")
        .first()
        .click();
      await expect(page.getByTestId("archived-foot")).toBeVisible();
      await survey(page, "archived-conversation");
      await page.goBack();
      if (!phone) {
        // In the mode Enter in the wish field waits like its send button:
        // nothing goes to the model.
        const asked: string[] = [];
        page.on("request", (r) => {
          if (r.url().includes("/api/v1/workspaces/icon/suggestions"))
            asked.push(r.url());
        });
        await page.getByTestId("account-menu-trigger").click();
        await page.getByTestId("menu-explain").click();
        const wish = page.getByTestId("workspace-icon-wish");
        await wish.fill("kettu");
        await wish.press("Enter");
        await expect(page.locator(".ah-explain-toast")).toBeVisible();
        await page.getByTestId("explain-stop").click();
        expect(asked).toEqual([]);
        await page.getByTestId("workspace-icon-button").first().click();
        await survey(page, "workspace-card");
        await page.keyboard.press("Escape");
        // A row's buttons show under the pointer.
        await page
          .locator('.ah-rail [data-testid="agent-link"]')
          .last()
          .hover();
        await survey(page, "rail-row");
      }
    });

    test(`@lab explain cards cover a new conversation at ${width}`, async ({
      page,
    }) => {
      test.setTimeout(60000);
      await signIn(page);
      await newConversation(page);
      await survey(page, "start");
      await page.getByTestId("composer-model-picker").click();
      await survey(page, "start-model");
      await page.keyboard.press("Escape");
      if (phone) {
        await page.getByTestId("conversation-menu").click();
        await survey(page, "conversation-menu");
        await page.keyboard.press("Escape");
      }
    });

    test(`@lab explain cards cover an answered conversation at ${width}`, async ({
      page,
    }) => {
      test.setTimeout(90000);
      await routeWorkers(page);
      await signIn(page);
      await answered(page);
      // Files the agent offered, for the assets chip and its panel.
      const target = new URL(page.url()).searchParams.get("conversation");
      expect(
        (
          await page.request.get(
            `/fixture/files?target=${encodeURIComponent(target ?? "")}&set=single`,
          )
        ).ok(),
      ).toBe(true);
      await page.reload();
      await expect(page.getByTestId("assets-chip")).toBeVisible();
      await survey(page, "conversation");
      const conversation = page.url();
      if (phone) {
        await page.getByTestId("phone-header-facts").click();
        await survey(page, "phone-header-facts");
        await page.keyboard.press("Escape");
      }
      for (const panel of [
        "background-processes",
        "background-spinoffs",
        "background-helpers",
      ]) {
        const chip = page.getByTestId(panel);
        if (!(await chip.count())) continue;
        await chip.click();
        await survey(page, `conversation-${panel}`);
        await chip.click();
      }
      for (const opener of [
        "git-chip",
        "context-ring",
        "guide-toggle",
        "assets-chip",
        "browser-chip",
        "workspace-details",
        "conversation-model",
        "conversation-menu",
        "toggle-terminal",
        "toggle-editor",
      ]) {
        const el = page.getByTestId(opener);
        const shown = await el
          .first()
          .waitFor({ timeout: 3000 })
          .then(() => true)
          .catch(() => false);
        if (!shown) continue;
        await el.first().click();
        await survey(page, `conversation-${opener}`);
        await page.keyboard.press("Escape");
        await page.goto(conversation);
        await expect(page.getByTestId("message-input")).toBeVisible();
      }
    });

    test(`@lab explain cards cover worker and helper views at ${width}`, async ({
      page,
    }) => {
      test.setTimeout(90000);
      await routeWorkers(page);
      await signIn(page);
      await newConversation(page);
      await page.getByTestId("background-spinoffs").click();
      await page.getByTestId("spinoff-Kastelun ajastus").click();
      await expect(page.getByTestId("worker-band")).toBeVisible();
      await survey(page, "worker");
      await page.getByTestId("parent-top").click();
      await page.getByTestId("background-helpers").click();
      await page.getByTestId("helper-layout-review").click();
      await survey(page, "helper");
    });

    test(`@lab explain cards cover every settings section at ${width}`, async ({
      page,
    }) => {
      test.setTimeout(120000);
      await signIn(page);
      for (const slug of Object.values(paths)) {
        await page.goto(`/settings/${slug}`);
        await expect(page.getByTestId("settings-title")).toBeAttached();
        await survey(page, `settings-${slug}`);
      }
    });
  });
}
