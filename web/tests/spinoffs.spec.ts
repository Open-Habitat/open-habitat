import { resolve } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import type { Spinoffs } from "../src/app/spinoffs";
import { hostOrigin, labOrigin } from "../test-ports.mjs";
import { createHostTest, expect } from "./worker-host";

const captureLab = process.env.OH_SPINOFF_CAPTURE === "1";
const test = createHostTest(captureLab);

test.use({
  baseURL: process.env.OH_SPINOFF_CAPTURE === "1" ? labOrigin : hostOrigin,
  ignoreHTTPSErrors: true,
  viewport: { width: 1280, height: 900 },
});
test.afterEach(async ({ page }) => {
  await page.unrouteAll({ behavior: "wait" });
});
test("@spinoffs @a11y follows native child rows, opens read-only and returns to parent, including phone", async ({
  page,
}) => {
  const runID = "01m521vczarx5bkx086n64t1t2";
  let merged = false;
  let unavailable = false;
  let parentReads = 0;
  await page.route("**/api/v1/agents/pi:*/spinoffs**", (route) => {
    if (unavailable) return route.fulfill({ status: 503, body: "offline" });
    if (!new URL(route.request().url()).searchParams.has("run")) parentReads++;
    const parent = new URL(route.request().url()).pathname
      .split("/agents/")[1]
      .split("/spinoffs")[0];
    const data: Spinoffs = {
      schema_version: 1,
      parent_id: parent,
      availability: "available",
      runs: [
        {
          run_id: runID,
          title: "README-esimerkit",
          created_at: "2026-10-16T10:00:05Z",
          state: merged ? "merged" : "working",
          summary: "Päivitettiin esimerkit.\n\n<script>not executable</script>",
          preserved: false,
          branch: "",
          worktree: "",
          source_branch: "main",
        },
      ],
      transcripts: new URL(route.request().url()).searchParams.has("run")
        ? [
            {
              node_id: "n-0001",
              availability: "available",
              truncated: false,
              messages: [
                { key: "worker:one", kind: "user", text: "Päivitä README." },
                {
                  key: "worker:two",
                  kind: "assistant",
                  text: "Esimerkit päivitetty.",
                },
              ],
            },
          ]
        : [],
    };
    return route.fulfill({ json: data });
  });
  await page.route("**/api/v1/agents/pi:*/history**", (route) => {
    const parent = new URL(route.request().url()).pathname
      .split("/agents/")[1]
      .split("/history")[0];
    return route.fulfill({
      json: {
        schema_version: 1,
        agent_id: parent,
        native_revision: "fixture-spinoffs",
        older_complete: true,
        boundary_found: true,
        entries: [
          {
            entry_key: "parent-request",
            kind: "user",
            timestamp: "2026-10-16T10:00:00Z",
            content: {
              media_type: "text/plain",
              text: "Valmistele julkaisu.",
              complete: true,
            },
          },
          {
            entry_key: "parent-answer",
            kind: "assistant",
            timestamp: "2026-10-16T10:00:03Z",
            content: {
              media_type: "text/plain",
              text: "Käynnistän spinoffin.",
              complete: true,
            },
          },
        ],
      },
    });
  });
  await page.route("**/api/v1/conversations/*/status**", async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    body.native_history = "present";
    body.native_revision = "fixture-spinoffs";
    body.run_active = false;
    body.state = "idle";
    await route.fulfill({ response, json: body });
  });
  await page.request.get("/fixture/scenario?value=ready");
  await page.goto("/workspaces");
  await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
  await page.getByRole("link", { name: "Alice" }).click();
  await page
    .getByRole("navigation")
    .getByRole("link", { name: captureLab ? "aurinkokello" : "ordinary-dir" })
    .click();
  await page.getByRole("button", { name: "Aloita uusi Pi-keskustelu" }).click();
  const group = page.getByRole("region", { name: "Spinoffit", exact: true });
  await expect(group).toBeVisible();
  // APIRequestContext bypasses page route fixtures: prove the authenticated
  // gateway really forwards the new read route to the disposable daemon home.
  const parentId = captureLab
    ? "pi:a1a1a1a1-0000-4000-8000-000000000001"
    : "pi:11111111-1111-4111-8111-111111111111";
  const nativeReply = await page.request.get(
    `/api/v1/agents/${parentId}/spinoffs`,
  );
  expect(nativeReply.status()).toBe(200);
  expect((await nativeReply.json()).availability).toBe("unavailable");
  await expect(group).toContainText("Työskentelee");
  // No separate sidebar child: the spinoff exists in its parent's thread only.
  await expect(
    page.getByRole("navigation").getByText("README-esimerkit"),
  ).toHaveCount(0);
  await expect(
    page.getByRole("region", { name: "Spinoffien tila" }),
  ).toContainText("README-esimerkit");
  merged = true;
  await expect(group).toContainText("Mergetty");
  if (process.env.OH_SPINOFF_CAPTURE === "1") {
    for (const theme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: theme });
      const { snapshot } = await import("../lab/session.mjs");
      await snapshot(
        page,
        resolve(`../issues/implement-spinoff-agents/group-${theme}`),
      );
    }
    await page.emulateMedia({ colorScheme: "light" });
  }
  await group.getByRole("button", { name: /README-esimerkit/ }).click();
  await expect(page).toHaveURL(/spinoff=/);
  await expect(
    page.getByRole("textbox", { name: "Viesti Pi:lle" }),
  ).toHaveCount(0);
  await expect(
    page.getByText("Esimerkit päivitetty.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Tulos", exact: true }),
  ).toContainText("Päivitettiin esimerkit.");
  await expect(page.getByText(/Spinoffille ei kirjoiteta/)).toBeVisible();
  await expect(page.locator(".ah-spinoff-view script")).toHaveCount(0);
  const axe = await new AxeBuilder({ page })
    .include(".ah-spinoff-view")
    .analyze();
  expect(axe.violations).toEqual([]);
  // Synthetic visual evidence, never a real account/home/provider.
  for (const [name, width] of [
    ["desktop", 1280],
    ["desktop-dark", 1280],
    ["phone", 390],
  ] as const) {
    await page.setViewportSize({ width, height: 900 });
    if (name !== "desktop") await page.emulateMedia({ colorScheme: "dark" });
    if (process.env.OH_SPINOFF_CAPTURE === "1") {
      const { snapshot } = await import("../lab/session.mjs");
      await snapshot(
        page,
        resolve(`../issues/implement-spinoff-agents/${name}`),
      );
    }
    await expect(
      page.getByRole("button", { name: "Kirjoita pääagentille →" }),
    ).toBeVisible();
  }
  const readsBeforeReturn = parentReads;
  await page.getByRole("button", { name: "Kirjoita pääagentille →" }).click();
  await expect(page).not.toHaveURL(/spinoff=/);
  await expect.poll(() => parentReads).toBeGreaterThan(readsBeforeReturn);
  await expect(group).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Viesti Pi:lle" }),
  ).toBeVisible();
  unavailable = true;
  await expect(
    page.getByRole("region", { name: "Spinoffien tila" }).getByRole("status"),
  ).toHaveText("Tila voi olla vanhentunut.");
  await expect(group).toContainText("Tila voi olla vanhentunut.");
});

// Live 2026-10-16: the parent kept working after starting its spinoffs, so
// the newest history page no longer held the creating row when the person
// came back, and the group vanished while the waiting line remained.
test("@spinoffs group stays when its creating row is older than the loaded page, across leaving, incomplete reads and settling", async ({
  page,
}) => {
  const runID = "01m53wnktnxb4w2xgdd79a66de";
  let state: "working" | "merged" = "working";
  let partial = false;
  await page.route("**/api/v1/agents/pi:*/spinoffs**", (route) => {
    const parent = new URL(route.request().url()).pathname
      .split("/agents/")[1]
      .split("/spinoffs")[0];
    const data: Spinoffs = {
      schema_version: 1,
      parent_id: parent,
      availability: partial ? "partial" : "available",
      runs: partial
        ? []
        : [
            {
              run_id: runID,
              title: "ui-test-ok",
              created_at: "2026-10-16T16:04:37.321422491Z",
              state,
              summary: "",
              preserved: false,
              branch: "",
              worktree: "",
              source_branch: "main",
            },
          ],
      transcripts: [],
    };
    return route.fulfill({ json: data });
  });
  const entry = (n: number) => ({
    entry_key: `later-${n}`,
    kind: n % 2 ? "assistant" : "user",
    timestamp: `2026-10-16T16:${String(10 + n).padStart(2, "0")}:00Z`,
    content: {
      media_type: "text/plain",
      text: `Myöhempi viesti ${n}.`,
      complete: true,
    },
  });
  await page.route("**/api/v1/agents/pi:*/history**", (route) => {
    const url = new URL(route.request().url());
    const parent = url.pathname.split("/agents/")[1].split("/history")[0];
    const older = url.searchParams.has("before");
    return route.fulfill({
      json: {
        schema_version: 1,
        agent_id: parent,
        native_revision: "fixture-spinoff-page",
        // Only the newest page: the spinoff was created before all of it.
        older_complete: older,
        boundary_found: true,
        ...(older ? {} : { next_before: "later-0" }),
        entries: older
          ? [
              {
                entry_key: "creating",
                kind: "assistant",
                timestamp: "2026-10-16T16:04:30Z",
                content: {
                  media_type: "text/plain",
                  text: "Käynnistän spinoffit.",
                  complete: true,
                },
              },
              entry(0),
            ]
          : [0, 1, 2, 3].map(entry),
      },
    });
  });
  await page.route("**/api/v1/conversations/*/status**", async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    body.native_history = "present";
    body.native_revision = "fixture-spinoff-page";
    body.run_active = false;
    body.state = "idle";
    await route.fulfill({ response, json: body });
  });
  await page.request.get("/fixture/scenario?value=ready");
  await page.goto("/workspaces");
  await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
  await page.getByRole("link", { name: "Alice" }).click();
  const workspace = page
    .getByRole("navigation")
    .getByRole("link", { name: captureLab ? "aurinkokello" : "ordinary-dir" });
  await workspace.click();
  await page.getByRole("button", { name: "Aloita uusi Pi-keskustelu" }).click();
  const group = page.getByRole("region", { name: "Spinoffit", exact: true });
  await expect(group).toContainText("ui-test-ok");
  await expect(page.getByText("Myöhempi viesti 0.")).toBeVisible();
  const conversation = page.url();
  // Leave and return: the store reads the newest page again.
  await workspace.click();
  await expect(page).not.toHaveURL(conversation);
  await page.goBack();
  await expect(page).toHaveURL(conversation);
  await expect(page.getByText("Myöhempi viesti 3.")).toBeVisible();
  await expect(group).toContainText("Työskentelee");
  // A read that omits the run is not proof that it is gone.
  partial = true;
  await expect(group).toContainText("Tila voi olla vanhentunut.");
  await expect(group).toContainText("ui-test-ok");
  partial = false;
  await expect(group).not.toContainText("Tila voi olla vanhentunut.");
  if (captureLab) {
    const { snapshot } = await import("../lab/session.mjs");
    for (const [name, width, scheme] of [
      ["desktop-light", 1280, "light"],
      ["desktop-dark", 1280, "dark"],
      ["phone-light", 390, "light"],
      ["phone-dark", 390, "dark"],
    ] as const) {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme: scheme });
      await group.scrollIntoViewIfNeeded();
      await snapshot(
        page,
        resolve(`../issues/spinoff-group-disappears/group-top-${name}`),
      );
    }
    await page.setViewportSize({ width: 1280, height: 900 });
  }
  state = "merged";
  await expect(group).toContainText("Mergetty");
  // Loading the older page moves the group to its native row.
  await page
    .getByRole("button", { name: "Lataa vanhempi historiasivu" })
    .click();
  await expect(page.getByText("Käynnistän spinoffit.")).toBeVisible();
  await expect(group).toContainText("Mergetty");
});
