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
              harness: "pi",
              availability: "available",
              truncated: false,
              entries: [
                {
                  entry_key: "worker-one",
                  kind: "user",
                  content: {
                    media_type: "text/plain",
                    text: "Päivitä README.",
                    complete: true,
                  },
                },
                {
                  entry_key: "worker-two",
                  kind: "assistant",
                  content: {
                    media_type: "text/plain",
                    text: "Esimerkit päivitetty.",
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
  await page
    .getByRole("button")
    .and(page.getByTestId("github-sign-in"))
    .click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
  await page
    .getByRole("navigation")
    .getByRole("link")
    .and(
      page.getByTestId(
        `workspace-${captureLab ? "aurinkokello" : "ordinary-dir"}`,
      ),
    )
    .click();
  await page
    .getByRole("button")
    .and(page.getByTestId("conversation-start"))
    .click();
  // The strip is the only spinoff presentation; the thread has no second one
  // above it (strip-duplicate-spinoff-ui).
  const strip = page
    .getByRole("region")
    .and(page.getByTestId("background-work"));
  const pill = strip
    .getByRole("button")
    .and(page.getByTestId("background-spinoffs"));
  await expect(pill).toBeVisible();
  await expect(page.locator("main")).toContainText("Käynnistän spinoffin.");
  await expect(page.locator(".ah-bg-strip")).toHaveCount(1);
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
  // No separate sidebar child: the spinoff exists in its parent's thread only.
  await expect(page.getByRole("navigation")).not.toContainText(
    "README-esimerkit",
  );
  await expect(
    page.getByRole("button").and(page.getByTestId("background-spinoffs")),
  ).toHaveAttribute("data-working", "1");
  // Nobody waits on it, and the closed pill says so.
  await expect(pill).toHaveAttribute("data-unwaited", "1");
  merged = true;
  await expect(pill).toHaveAttribute("data-working", "0");
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
  await pill.click();
  await strip.getByRole("button").and(page.getByTestId("ended-runs")).click();
  await strip
    .getByRole("button")
    .and(page.getByTestId("spinoff-README-esimerkit"))
    .click();
  await expect(page).toHaveURL(/spinoff=/);
  await expect(
    page.getByRole("textbox").and(page.getByTestId("message-input")),
  ).toHaveCount(0);
  await expect(page.locator("main")).toContainText("Esimerkit päivitetty.");
  await expect(
    page.getByRole("complementary").and(page.getByTestId("spinoff-result")),
  ).toContainText("Päivitettiin esimerkit.");
  await expect(
    page.getByRole("button").and(page.getByTestId("worker-ask")),
  ).toBeVisible();
  await expect(page.locator(".ah-worker-frame script")).toHaveCount(0);
  const axe = await new AxeBuilder({ page })
    .include(".ah-worker-frame")
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
      page.getByRole("button").and(page.getByTestId("worker-ask")),
    ).toBeVisible();
  }
  const readsBeforeReturn = parentReads;
  // Asking goes through the main agent: the chip leads straight back to it.
  await page.getByRole("button").and(page.getByTestId("worker-ask")).click();
  await expect(page).not.toHaveURL(/spinoff=/);
  await expect.poll(() => parentReads).toBeGreaterThan(readsBeforeReturn);
  await expect(pill).toBeVisible();
  await expect(
    page.getByRole("textbox").and(page.getByTestId("message-input")),
  ).toBeVisible();
  unavailable = true;
  if (!(await strip.getByRole("tabpanel").count())) await pill.click();
  await expect(page.getByRole("tabpanel").getByRole("status")).toBeVisible();
});

// Live 2026-10-16: the parent kept working after starting its spinoffs, so
// the newest history page no longer held the creating row when the person
// came back (spinoff-group-disappears). The strip is now the only spinoff
// presentation (strip-duplicate-spinoff-ui); it follows Taskfleet, not the
// loaded page, and an incomplete read does not erase a known run.
test("@spinoffs strip keeps a spinoff created before the loaded page, across leaving, incomplete reads and settling", async ({
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
  await page
    .getByRole("button")
    .and(page.getByTestId("github-sign-in"))
    .click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
  const workspace = page
    .getByRole("navigation")
    .getByRole("link")
    .and(
      page.getByTestId(
        `workspace-${captureLab ? "aurinkokello" : "ordinary-dir"}`,
      ),
    );
  await workspace.click();
  await page
    .getByRole("button")
    .and(page.getByTestId("conversation-start"))
    .click();
  const strip = page
    .getByRole("region")
    .and(page.getByTestId("background-work"));
  const pill = strip
    .getByRole("button")
    .and(page.getByTestId("background-spinoffs"));
  const panel = strip.getByRole("tabpanel");
  await expect(pill).toHaveAttribute("data-working", "1");
  await expect(page.locator("main")).toContainText("Myöhempi viesti 0.");
  await expect(page.locator(".ah-bg-strip")).toHaveCount(1);
  const conversation = page.url();
  // Leave and return: the store reads the newest page again.
  await workspace.click();
  await expect(page).not.toHaveURL(conversation);
  await page.goBack();
  await expect(page).toHaveURL(conversation);
  await expect(page.locator("main")).toContainText("Myöhempi viesti 3.");
  await expect(pill).toHaveAttribute("data-working", "1");
  await pill.click();
  await expect(panel).toContainText("ui-test-ok");
  // A read that omits the run is not proof that it is gone.
  partial = true;
  await expect(panel.getByRole("status")).toBeVisible();
  await expect(panel).toContainText("ui-test-ok");
  partial = false;
  await expect(panel.getByRole("status")).toHaveCount(0);
  state = "merged";
  await expect(pill).toHaveAttribute("data-working", "0");
  // Loading the older page brings back no thread group.
  await page.keyboard.press("Escape");
  await page.getByRole("button").and(page.getByTestId("older-history")).click();
  await expect(page.locator("main")).toContainText("Käynnistän spinoffit.");
  await expect(page.locator(".ah-bg-strip")).toHaveCount(1);
});

// Live 2026-10-16: a release restart ended the parent's Pi and its wait while
// the spinoff kept working, and the sidebar showed no mark. The mark follows
// the parent's working runs from Taskfleet, through the real daemon snapshot.
test("@spinoffs sidebar marks a working spinoff without a live wait after a daemon restart, and clears when it settles", async ({
  page,
}) => {
  test.setTimeout(90000);
  expect(
    (await page.request.get("/fixture/conversations-reset")).status(),
  ).toBe(204);
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
  const editor = page
    .getByRole("textbox")
    .and(page.getByTestId("message-input"));
  await editor.fill("käynnistä spinoff");
  await page.getByRole("button").and(page.getByTestId("send")).click();
  await expect(page.locator("main")).toContainText(
    'Selvä. Kysyit: "käynnistä spinoff".',
    { timeout: 20000 },
  );
  const parent = new URL(page.url()).searchParams
    .get("conversation")
    ?.replace(/^pi:/, "");
  expect(parent).toMatch(/^[0-9a-f-]{36}$/);
  const row = page
    .getByRole("navigation")
    .getByTestId(`agent-item-pi:${parent}`);
  // Its turn ended: not Running; the reply read here waits in Sinun vuorosi
  // until the person answers or says Ei nyt (raise-to-your-turn).
  const rail = page.getByRole("navigation");
  const read = rail
    .getByTestId("rail-yours")
    .getByTestId(`agent-item-pi:${parent}`)
    .getByTestId("rail-mark");
  await expect(read).toHaveAttribute("data-state", "read");
  await expect(
    rail.getByTestId("rail-running").getByTestId(`agent-item-pi:${parent}`),
  ).toHaveCount(0);
  expect(
    (
      await page.request.get(
        `/fixture/taskfleet?parent=${parent}&workspace=ordinary-dir&status=running`,
      )
    ).status(),
  ).toBe(204);
  expect((await page.request.get("/fixture/daemon-restart")).status()).toBe(
    204,
  );
  await page.reload();
  await expect(editor).toBeEnabled({ timeout: 20000 });
  await expect(row).toHaveClass(/ah-waiting-spinoff/);
  // No wait exists, so nothing claims the agent waits for the spinoff.
  await expect(row).not.toHaveAttribute("data-waiting", "true");
  expect(
    (
      await page.request.get(
        `/fixture/taskfleet?parent=${parent}&workspace=ordinary-dir&status=done`,
      )
    ).status(),
  ).toBe(204);
  await page
    .getByRole("button")
    .and(page.getByTestId("snapshot-refresh"))
    .click();
  // The restart ended the agent's own run, so with its worker done nothing
  // keeps it in Käynnissä.
  await expect(
    rail.getByTestId("rail-running").getByTestId(`agent-item-pi:${parent}`),
  ).toHaveCount(0);
  await expect(read).toHaveAttribute("data-state", "read");
  await expect(row).not.toHaveClass(/ah-waiting-spinoff/);
});

// Merkit (Jari 16.10.2026) and Pisteet (26.10.2026): the spinoff pill marks
// the spinoff the agent waits on, keeps a red dot until a failed spinoff's
// branch is gone, and its tab lists spinoffs (never the wait process) with
// Lopeta odotus.
test("@spinoffs @a11y spinoff tab: a mark for the wait, a standing red dot until the branch is gone, stop the wait, open a row", async ({
  page,
}) => {
  const waited = "01m53wnktnxb4w2xgdd79a66de";
  const failed = "01m53wnje1f3ybcw17qsx2sysd";
  let preserved = true;
  const stops: unknown[] = [];
  await page.route("**/api/v1/agents/pi:*/spinoffs**", (route) => {
    const url = new URL(route.request().url());
    const run = url.searchParams.get("run");
    const runs: Spinoffs["runs"] = [
      {
        run_id: waited,
        title: "ui-test-ok",
        created_at: new Date(Date.now() - 4 * 60000).toISOString(),
        state: "working",
        summary: "",
        preserved: false,
        branch: "",
        worktree: "",
        source_branch: "main",
      },
      {
        run_id: failed,
        title: "ui-test-fail",
        created_at: new Date(Date.now() - 9 * 60000).toISOString(),
        state: "unmerged",
        summary: "Testit eivät menneet läpi.",
        preserved,
        branch: preserved ? "wt/ui-test-fail" : "",
        worktree: "",
        source_branch: "main",
      },
    ];
    return route.fulfill({
      json: {
        schema_version: 1,
        parent_id: url.pathname.split("/agents/")[1].split("/spinoffs")[0],
        availability: "available",
        runs: run ? runs.filter((r) => r.run_id === run) : runs,
        transcripts: [],
      },
    });
  });
  await page.route("**/api/v1/conversations/*/processes**", async (route) => {
    if (route.request().url().endsWith("/stop")) {
      stops.push(route.request().postDataJSON());
      return route.fulfill({ json: { schema_version: 1, result: "killed" } });
    }
    return route.fulfill({
      json: {
        schema_version: 1,
        owner_generation: "og_example",
        availability: "available",
        unavailable_reason: null,
        interrupted: [],
        processes: [
          {
            id: "proc_wait",
            name: "odota-ui-test",
            command_preview: `taskfleet run wait ${waited} --output json`,
            process_token: "pt_wait",
            status: "running",
            started_at: Date.now() - 3 * 60000,
            ended_at: null,
            exit_code: null,
            signal: null,
            end_reason: null,
            wakes_agent: true,
            run_ids: [waited],
          },
        ],
      },
    });
  });
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
  const pill = strip
    .getByRole("button")
    .and(page.getByTestId("background-spinoffs"));
  await expect(pill).toHaveAttribute("data-working", "1");
  // The closed pill marks the working spinoff as waited on.
  await expect(pill).toHaveAttribute("data-waited", "1");
  await expect(pill).toHaveAttribute("data-unwaited", "0");
  await expect(pill).toHaveAttribute("data-unfinished", "1");
  // The wait belongs to its spinoff: no process pill for it.
  await expect(
    strip.getByRole("button").and(page.getByTestId("background-processes")),
  ).toHaveCount(0);
  await pill.click();
  const panel = strip.getByRole("tabpanel");
  // The finished part opens by itself where the red dot points.
  await expect(
    panel.getByRole("button").and(page.getByTestId("spinoff-ui-test-fail")),
  ).toBeVisible();
  await expect(panel).not.toContainText("odota-ui-test");
  await expect(panel.locator('.ah-bg-row[data-waited="true"]')).toHaveCount(1);
  expect(
    (await new AxeBuilder({ page }).include(".ah-bg-strip").analyze())
      .violations,
  ).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(panel).toHaveCount(0);
  await expect(pill).toBeFocused();
  // Looking does not clear it: the branch still exists.
  await expect(pill).toHaveAttribute("data-unfinished", "1");
  await pill.click();
  await panel.getByRole("button").and(page.getByTestId("stop-wait")).click();
  await expect.poll(() => stops.length).toBe(1);
  expect(stops[0]).toEqual({
    owner_generation: "og_example",
    process_token: "pt_wait",
    force: false,
  });
  await expect(
    page.getByTestId("notice-stack").getByTestId("background-notice"),
  ).toBeVisible();
  await panel
    .getByRole("button")
    .and(page.getByTestId("spinoff-ui-test-fail"))
    .click();
  await expect(page).toHaveURL(new RegExp(`spinoff=${failed}`));
  await page.getByRole("button").and(page.getByTestId("parent-top")).click();
  preserved = false;
  await expect(pill).toHaveAttribute("data-unfinished", "0");
});

// Pilot.12 (Jari 26.10.2026): a run the conversation created in another
// repository was live, but Taskfleet read its supervisor as dead and the
// restart had cut the wait. The closed pill still shows the worker.
test("@spinoffs a live run in another state keeps its mark on the closed pill", async ({
  page,
}) => {
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
            run_id: "01m5w60pxynq08hyrxde3s1dyn",
            title: "release pilot.12",
            created_at: new Date(Date.now() - 50 * 60000).toISOString(),
            state: "unknown",
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
  const pill = page
    .getByRole("region")
    .and(page.getByTestId("background-work"))
    .getByRole("button")
    .and(page.getByTestId("background-spinoffs"));
  await expect(pill).toHaveAttribute("data-working", "0");
  await expect(pill).not.toHaveClass(/\bidle\b/);
  await expect(
    pill.locator('.ah-bg-marks .ah-worker-mark[data-kind="unknown"]'),
  ).toHaveCount(1);
  await expect(pill).toHaveAccessibleName(/1 muussa tilassa/);
  await pill.click();
  await expect(
    page
      .getByRole("tabpanel")
      .locator('[data-kind="spin"]')
      .filter({ has: page.getByTestId("spinoff-release pilot.12") }),
  ).toHaveAttribute("data-state", "unknown");
});
