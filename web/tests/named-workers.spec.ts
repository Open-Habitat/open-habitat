import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import type { Spinoff, Spinoffs } from "../src/app/spinoffs";
import { hostOrigin } from "../test-ports.mjs";
import { expect, test } from "./worker-host";

// Avustajat (named-workers-in-habitat, experimental): Taskfleet's named
// workers get one chip beside the Workers pill with the Botit icon, a mark
// each, and a list whose rows open the worker's own read-only view. The
// daemon's reading of Taskfleet's round state is proved in Go
// (resident_linux_test.go); here the browser draws what the route says.
test.use({
  baseURL: hostOrigin,
  ignoreHTTPSErrors: true,
  viewport: { width: 1280, height: 900 },
  deviceScaleFactor: 2,
});

const evidence = "../issues/named-workers-in-habitat/evidence";
const capture = !!process.env.OH_VISUAL_CAPTURE;

async function session(page: Page) {
  const s = await (await page.request.get("/auth/session")).json();
  return {
    Origin: new URL(page.url()).origin,
    "X-Agent-Host-CSRF": s.csrf as string,
  };
}

const base = {
  preserved: false,
  branch: "",
  worktree: "",
  source_branch: "main",
  summary: "",
  harness: "claude",
} as const;
const runs = (): Spinoff[] => [
  {
    ...base,
    run_id: "01m6r1q934veb852ke10x2r3aa",
    title: "sharepoint-skipped-sites-recover",
    created_at: new Date(Date.now() - 7 * 60000).toISOString(),
    state: "working",
    harness: "pi",
  },
  {
    ...base,
    run_id: "01m6r1q934veb852ke10x2r3ab",
    title: "M365-asetusvirta",
    created_at: new Date(Date.now() - 90 * 60000).toISOString(),
    state: "waiting_parent",
    resident: {
      name: "proto-m365",
      round_state: "waiting",
      rounds: 2,
      report:
        "Kierros 2: kolme riffiä A Listasta, suositus A1.\nKuvat evidence/-kansiossa.",
      reported_at: new Date(Date.now() - 3 * 60000).toISOString(),
      landed_round: 2,
    },
  },
  {
    ...base,
    run_id: "01m6r1q934veb852ke10x2r3ac",
    title: "SharePoint-korjauksen katselmointi",
    created_at: new Date(Date.now() - 60 * 60000).toISOString(),
    state: "working",
    resident: { name: "review-sharepoint", round_state: "working", rounds: 1 },
  },
];

test("@named-workers @a11y named workers have their own chip only while Avustajat is on, and opening one clears its new report", async ({
  page,
}) => {
  await page.route("**/api/v1/agents/pi:*/spinoffs**", (route) => {
    const url = new URL(route.request().url());
    const data: Spinoffs = {
      schema_version: 1,
      parent_id: url.pathname.split("/agents/")[1].split("/spinoffs")[0],
      availability: "available",
      runs: runs(),
      transcripts: url.searchParams.has("run")
        ? [
            {
              node_id: "n-0001",
              harness: "claude",
              availability: "available",
              truncated: false,
              entries: [
                {
                  entry_key: "round-two",
                  kind: "assistant",
                  content: {
                    media_type: "text/plain",
                    text: "Kierros 2 valmis: A1, A2 ja A3.",
                    complete: true,
                  },
                },
              ],
            },
          ]
        : [],
    };
    return route.fulfill({ json: data });
  });
  await page.route("**/api/v1/conversations/*/processes**", (route) =>
    route.fulfill({
      json: {
        schema_version: 1,
        owner_generation: "og_example",
        availability: "available",
        unavailable_reason: null,
        interrupted: [],
        processes: [],
      },
    }),
  );
  await page.request.get("/fixture/scenario?value=ready");
  await page.goto("/workspaces");
  await page
    .getByRole("button")
    .and(page.getByTestId("github-sign-in"))
    .click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
  await page
    .getByRole("navigation")
    .getByRole("link")
    .and(page.getByTestId("workspace-ordinary-dir"))
    .click();
  await page
    .getByRole("button")
    .and(page.getByTestId("conversation-start"))
    .click();
  const strip = page
    .getByRole("region")
    .and(page.getByTestId("background-work"));
  const workers = strip
    .getByRole("button")
    .and(page.getByTestId("background-spinoffs"));
  const chip = strip
    .getByRole("button")
    .and(page.getByTestId("background-helpers"));

  // Off by default: every worker is in the Workers pill, and a named worker
  // between rounds waits for the main agent rather than at its terminal.
  await expect(workers).toBeVisible();
  await expect(chip).toHaveCount(0);
  await workers.click();
  await expect(
    strip
      .getByRole("tabpanel")
      .getByTestId("spinoff-M365-asetusvirta")
      .getByTestId("spinoff-facts"),
  ).toContainText("odottaa pääagenttia");
  await workers.click();

  expect(
    (
      await page.request.put("/api/v1/account/preferences", {
        headers: await session(page),
        data: { experimental: { "named-workers": true } },
      })
    ).ok(),
  ).toBeTruthy();
  await page.reload();

  // On: the one-shot worker stays in its pill, the two named workers move
  // to the chip with a mark each: a new report and a round under way.
  await expect(chip).toBeVisible();
  // The chip is icon/marks-only, but remains named for assistive technology.
  await expect(chip).toHaveText("");
  await page.keyboard.press("Tab");
  await chip.focus();
  await expect(page.getByRole("tooltip")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(chip.locator('svg path[d^="M9 7v3"]')).toHaveCount(1);
  await expect(workers).toHaveAttribute("data-working", "1");
  await expect(chip).toHaveAttribute("data-unseen", "1");
  await expect(chip).toHaveAccessibleName(
    /Avustajat: 2.*proto-m365 kierros 2 raportoitu.*review-sharepoint kierros 2 työn alla/,
  );
  await expect(
    chip.locator('.ah-worker-mark[data-kind="reported"]'),
  ).toHaveCount(1);
  await expect(
    chip.locator('.ah-worker-mark[data-kind="working"]'),
  ).toHaveCount(1);
  if (capture)
    await strip.screenshot({ path: `${evidence}/chip-desktop-light.png` });

  await chip.click();
  const panel = strip.getByRole("tabpanel");
  const proto = panel.getByTestId("helper-proto-m365");
  await expect(proto.getByTestId("helper-facts")).toContainText(
    "kierros 2 raportoitu",
  );
  await expect(proto.getByTestId("helper-report")).toHaveText(
    "2. kierros: Kierros 2: kolme riffiä A Listasta, suositus A1.",
  );
  await expect(proto).toContainText("2 kierrosta");
  await expect(
    panel.getByTestId("helper-review-sharepoint").getByTestId("helper-facts"),
  ).toContainText("kierros 2 työn alla");
  // The person writes to a helper only through the main agent: no request,
  // no stop and no composer of its own on the row.
  await expect(panel.getByTestId("ask-agent")).toHaveCount(0);
  await expect(panel.getByTestId("helpers-note")).toHaveCount(0);
  const axe = await new AxeBuilder({ page })
    .include('[data-testid="background-work"]')
    .analyze();
  expect(axe.violations).toEqual([]);
  if (capture) {
    await page.screenshot({ path: `${evidence}/list-desktop-light.png` });
    await page.emulateMedia({ colorScheme: "dark" });
    await page.screenshot({ path: `${evidence}/list-desktop-dark.png` });
    await page.emulateMedia({ colorScheme: "light" });
  }

  expect(
    (
      await page.request.put("/api/v1/account/preferences", {
        headers: await session(page),
        data: { experimental: { "explain-mode": true } },
      })
    ).ok(),
  ).toBeTruthy();
  await page.reload();
  await chip.click();
  await page.getByTestId("explain-toggle").click();
  await chip.hover();
  await expect(page.getByTestId("explain-card")).toHaveAttribute(
    "data-card",
    "V15",
  );
  await proto.hover();
  await expect(page.getByTestId("explain-card")).toHaveAttribute(
    "data-card",
    "V16",
  );

  // Its own read-only view says where its rounds stand; opening it shows
  // the report, so the chip's new-report mark clears.
  await proto.click();
  await expect(page).toHaveURL(/spinoff=01m6r1q934veb852ke10x2r3ab/);
  await expect(page.locator("main")).toContainText(
    "Avustaja · 2 kierrosta · odottaa pääagenttia",
  );
  await expect(
    page.getByRole("textbox").and(page.getByTestId("message-input")),
  ).toHaveCount(0);
  await page.keyboard.press("Escape");
  await page.goBack();
  await expect(chip).toHaveAttribute("data-unseen", "0");
  await expect(
    chip.locator('.ah-worker-mark[data-kind="waiting_parent"]'),
  ).toHaveCount(1);

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(chip).toBeVisible();
  if (capture) {
    await chip.click();
    await page.screenshot({ path: `${evidence}/list-phone-light.png` });
  }
});
