import AxeBuilder from "@axe-core/playwright";
import inventoryFixture from "../../contracts/v1/examples/process-inventory.json" with {
  type: "json",
};
import outputFixture from "../../contracts/v1/examples/process-output.json" with {
  type: "json",
};
import type { ProcessInventory } from "../src/app/processes";
import { hostOrigin } from "../test-ports.mjs";
import { expect, test } from "./worker-host";

test.use({
  baseURL: hostOrigin,
  ignoreHTTPSErrors: true,
  viewport: { width: 1280, height: 900 },
});
test.afterEach(async ({ page }) => {
  // Inventory/status polling can still have a route.fetch in flight when the
  // assertions finish. Finish those fixture replies before closing the page.
  await page.unrouteAll({ behavior: "wait" });
});

// Real synthetic host for authentication/controller/navigation. The process
// endpoints are explicit wire fixtures, not evidence for the native bridge.
test("@process-tray @a11y a process row opens its window: bounded output, follow and pause, stop, force stop and clearing", async ({
  page,
}) => {
  const inventory = structuredClone(inventoryFixture) as ProcessInventory;
  inventory.interrupted = [];
  let tail = "ensimmäinen loppuosa";
  const stops: unknown[] = [];
  await page.route("**/api/v1/conversations/*/processes**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith("/output")) {
      expect(url.searchParams.get("owner_generation")).toBe("og_example");
      expect(url.searchParams.get("process_token")).toBe("pt_example");
      expect(url.searchParams.get("tail_lines")).toBe("200");
      await route.fulfill({
        json: { ...outputFixture, lines: [{ stream: "stderr", text: tail }] },
      });
    } else if (url.pathname.endsWith("/stop")) {
      stops.push(route.request().postDataJSON());
      if (stops.length === 1) {
        inventory.processes[0].status = "terminate_timeout";
        await route.fulfill({
          json: { schema_version: 1, result: "terminate_timeout" },
        });
      } else {
        inventory.processes[0].status = "killed";
        inventory.processes[0].ended_at = Date.now();
        await route.fulfill({ json: { schema_version: 1, result: "killed" } });
      }
    } else if (url.pathname.endsWith("/clear-finished")) {
      expect(route.request().postDataJSON()).toEqual({
        owner_generation: "og_example",
      });
      inventory.processes = [];
      await route.fulfill({ json: { schema_version: 1, result: "cleared" } });
    } else await route.fulfill({ json: inventory });
  });
  await page.request.get("/fixture/scenario?value=ready");
  await page.goto("/workspaces");
  await page.getByTestId("github-sign-in").click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
  await page
    .getByRole("navigation")
    .getByTestId("workspace-ordinary-dir")
    .click();
  await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
  const strip = page.getByTestId("background-work");
  await strip.getByTestId("background-processes").click();
  // A row is the name and a piece of its command; it opens a window.
  const row = strip
    .getByTestId("process-open")
    .and(page.locator('[data-process-id="proc_example"]'));
  await row.click();
  const window = page.getByTestId("process-dialog");
  await expectNativeContent(window, /ensimmäinen loppuosa/, {});
  await expectNativeContent(window, "$ npm test", {});
  await window.getByTestId("process-follow").click();
  tail = "uusi loppuosa";
  await expectNativeContent(window, /ensimmäinen loppuosa/, {});
  await window.getByTestId("process-follow").click();
  await expectNativeContent(window, /uusi loppuosa/, {});
  await window
    .getByTestId(/^(stop-process|process-stop)$/)
    .and(page.locator(':not([data-force="true"])'))
    .click();
  await expect(
    window
      .getByTestId("force-stop-process")
      .or(
        window
          .getByTestId("process-stop")
          .and(page.locator('[data-force="true"]')),
      ),
  ).toHaveCount(1);
  await window
    .getByTestId("force-stop-process")
    .or(
      window
        .getByTestId("process-stop")
        .and(page.locator('[data-force="true"]')),
    )
    .click();
  expect(stops).toEqual([
    {
      owner_generation: "og_example",
      process_token: "pt_example",
      force: false,
    },
    {
      owner_generation: "og_example",
      process_token: "pt_example",
      force: true,
    },
  ]);
  const accessibility = await new AxeBuilder({ page })
    .include(".ah-process-window")
    .include(".ah-bg-strip")
    .analyze();
  expect(accessibility.violations).toEqual([]);
  await window.getByTestId("clear-finished-processes").click();
  await expect(window).toHaveCount(0);
  await expect(strip).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByTestId("message-input")).toBeInViewport();
});

test("@process-tray unavailable native inventory is not an empty list", async ({
  page,
}) => {
  await page.route("**/api/v1/conversations/*/processes", (route) =>
    route.fulfill({
      json: {
        schema_version: 1,
        owner_generation: null,
        availability: "unavailable",
        unavailable_reason: "extension_missing",
        processes: [],
        interrupted: [],
      },
    }),
  );
  await page.request.get("/fixture/scenario?value=ready");
  await page.goto("/workspaces");
  await page.getByTestId("github-sign-in").click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
  await page
    .getByRole("navigation")
    .getByTestId("workspace-ordinary-dir")
    .click();
  await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
  const pill = page.getByTestId("background-processes");
  await expect(pill).toBeVisible();
  await pill.click();
  await expect(page.getByTestId("process-unavailable")).toBeVisible();
  await expect(page.getByTestId("process-empty")).toHaveCount(0);
});

test("@process-tray waiting facts flow through header, recap, home and typed completion, then a native wake becomes steerable", async ({
  page,
}) => {
  let phase: "process" | "spinoff" | "question" | "working" = "process";
  const inventory = structuredClone(inventoryFixture) as ProcessInventory;
  inventory.interrupted = [];
  const record = inventory.processes[0];
  const runId = "01m51veyk0hsa1br34epkr2rpg";
  await page.route("**/api/v1/conversations/*/processes**", (route) =>
    route.fulfill({
      json: route.request().url().includes("/output?")
        ? outputFixture
        : inventory,
    }),
  );
  await page.route("**/api/v1/conversations/*/status**", async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    body.state = phase === "working" ? "accepted" : "idle";
    body.run_active = phase === "working" || phase === "question";
    body.pending_question =
      phase === "question"
        ? {
            request_id: "q",
            question_kind: "input",
            prompt: "Valitse jatko",
            choices: [],
          }
        : null;
    body.native_history = "present";
    body.native_revision = "synthetic-process-revision";
    await route.fulfill({ response, json: body });
  });
  await page.route("**/api/v1/snapshot", async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    for (const agent of body.agents) {
      if (agent.agent_id === "pi:11111111-1111-4111-8111-111111111111")
        continue;
      // The real fake-Pi child is still empty; supply the native-work facts
      // this wire-level journey is explicitly testing.
      agent.process = "daemon_managed_live";
      agent.control = "owned";
      agent.title.display = "Prosessikoe";
      agent.history = "readable";
      agent.run_active = phase === "working" || phase === "question";
      agent.pending_question =
        phase === "question"
          ? {
              request_id: "q",
              question_kind: "input",
              prompt: "Valitse jatko",
              choices: [],
            }
          : null;
      agent.activity = phase === "working" ? "running" : "idle";
      agent.waiting_on = [
        {
          process_id: record.id,
          name: record.name,
          kind: phase === "spinoff" ? "taskfleet_wait" : "process",
          run_ids: record.run_ids,
          ...(record.spinoff ? { spinoff: record.spinoff } : {}),
        },
      ];
    }
    await route.fulfill({ response, json: body });
  });
  await page.route("**/api/v1/agents/pi:*/history**", (route) => {
    const agentId = new URL(route.request().url()).pathname
      .split("/agents/")[1]
      .split("/history")[0];
    return route.fulfill({
      json: {
        schema_version: 1,
        agent_id: agentId,
        native_revision: "synthetic-process-revision",
        older_complete: true,
        boundary_found: true,
        entries: [
          {
            entry_key: "done1",
            kind: "unknown",
            content: { media_type: "text/plain", text: "", complete: true },
            blocks: [
              {
                type: "process_event",
                process_event: {
                  kind: "success",
                  process_id: "proc_done",
                  process_name: "haku",
                  command_preview: "",
                  exit_code: 0,
                  signal: null,
                  end_reason: "exit",
                  delivery: null,
                  run_ids: [],
                },
              },
            ],
          },
        ],
      },
    });
  });
  await page.route("**/api/v1/agents/pi:*/recap", (route) =>
    route.fulfill({
      json: {
        schema_version: 1,
        latest_message: "done1",
        latest_message_at: new Date().toISOString(),
        recap: {
          recap: "Synteettinen työ jatkuu taustalla.",
          next: "Odota valmistumista.",
          through: "done1",
          generated_at: Date.now(),
          trigger: "manual",
        },
      },
    }),
  );
  await page.request.get("/fixture/scenario?value=ready");
  await page.goto("/workspaces");
  await page.getByTestId("github-sign-in").click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
  await page
    .getByRole("navigation")
    .getByTestId("workspace-ordinary-dir")
    .click();
  await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
  const header = page.locator(".ah-agent-header");
  await page.getByRole("navigation").getByTestId("snapshot-refresh").click();
  await expect(header.getByTestId("process-waiting")).toBeVisible();
  await expect(page.getByTestId("process-completion-toggle")).toBeVisible();
  // The recap card is only "Tilannekatsaus"; the header says who waits.
  const recapCard = page.getByTestId("recap-card");
  await expect(recapCard).toBeVisible();
  await expect(recapCard.getByTestId("recap-heading")).toBeVisible();
  await expect(recapCard.getByTestId("process-waiting")).toHaveCount(0);
  await header.getByTestId("process-waiting").click();
  const window = page.getByTestId("process-dialog");
  await expectNativeContent(window, "Synthetic output", { exact: true });
  await window.getByTestId(/^(close|dialog-close|process-close)$/).click();
  await expect(window).toHaveCount(0);
  phase = "spinoff";
  record.run_ids = [runId];
  record.spinoff = [
    {
      run_id: runId,
      title: "README",
      status: "running",
      landed: false,
      commit: null,
    },
  ];
  await page.getByRole("navigation").getByTestId("snapshot-refresh").click();
  await expect(header.getByTestId("spinoff-waiting")).toBeVisible();
  const waitingRow = page.locator(".ah-waiting-spinoff");
  await expect(waitingRow).toHaveCount(1);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  // The agent waits on its worker: the row's mark is the background wait,
  // the door drifting slowly round the ring; no branch mark at the row's end.
  const mark = waitingRow.getByTestId("rail-mark");
  await expect(mark).toBeVisible();
  await expect(mark).toHaveAttribute("data-state", "background");
  await expect(waitingRow.locator(".ah-worker-branch")).toHaveCount(0);
  expect(
    await mark
      .locator(".oh-ring")
      .evaluate((el) => getComputedStyle(el).animationName),
  ).toBe("oh-drift");
  await page.emulateMedia({ reducedMotion: "reduce" });
  const agentUrl = page.url();
  const agentId = new URL(agentUrl).searchParams.get("conversation");
  const homeCard = page
    .getByTestId(/^conversation-card-/)
    .and(page.locator(`[data-agent-id="${agentId}"]`));
  await page.getByTestId("home-link").filter({ visible: true }).click();
  await expect(page.locator(".ah-home-head")).toBeVisible();
  await expect(homeCard).toBeVisible();
  phase = "question";
  await page.getByRole("navigation").getByTestId("snapshot-refresh").click();
  await expect(homeCard.getByTestId("open-conversation")).toBeVisible();
  await expect(
    page
      .getByRole("navigation")
      .getByTestId("agent-link")
      .and(page.locator(`a[href*="conversation=${agentId ?? ""}"]`)),
  ).toBeVisible();
  await expect(page.locator(".ah-home-card-waiting_background")).toHaveCount(0);
  phase = "working";
  await page.goto(agentUrl);
  await page.getByRole("navigation").getByTestId("snapshot-refresh").click();
  await expect(header).toHaveAttribute("data-activity", "working");
  await expect(
    page
      .getByTestId("composer-stop")
      .and(page.locator('[data-stop-target="agent"]')),
  ).toBeVisible();
  await expect(header.getByTestId("spinoff-waiting")).toHaveCount(0);
});

// Merkit (Jari 16.10.2026): a small pill, a floating panel and a process
// window whose output is bounded and scrolls on its own surface. Exercise the
// built bundle: a missing import or stylesheet must fail.
test("@process-tray @a11y Merkit pill, panel and process window keep their layout in both themes and widths", async ({
  page,
}) => {
  const inventory = structuredClone(inventoryFixture) as ProcessInventory;
  inventory.interrupted = [];
  inventory.processes[0].started_at = Date.now() - 5000;
  const finished = {
    ...inventory.processes[0],
    id: "finished",
    process_token: "pt_finished",
    name: "viiden-sekunnin-demo",
    status: "exited" as const,
    ended_at: Date.now(),
    exit_code: 0,
  };
  inventory.processes.push(finished);
  await page.route("**/api/v1/conversations/*/processes**", (route) =>
    route.fulfill({
      json: route.request().url().includes("/output?")
        ? {
            ...outputFixture,
            process_id: finished.id,
            process_token: finished.process_token,
            lines: Array.from({ length: 80 }, (_, i) => ({
              stream: "stdout",
              text: `${i} ${"output ".repeat(35)}`,
            })),
          }
        : inventory,
    }),
  );
  await page.request.get("/fixture/scenario?value=ready");
  await page.goto("/workspaces");
  await page.getByTestId("github-sign-in").click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
  await page
    .getByRole("navigation")
    .getByTestId("workspace-ordinary-dir")
    .click();
  await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
  const strip = page.getByTestId("background-work");
  const pill = strip.getByTestId("background-processes");
  const composer = page.getByTestId("message-input");
  for (const width of [1280, 390])
    for (const theme of ["light", "dark"]) {
      await page.setViewportSize({ width, height: 900 });
      await page.evaluate((theme) => {
        document.documentElement.dataset.theme = theme;
      }, theme);
      if ((await pill.getAttribute("aria-expanded")) === "true")
        await pill.click();
      // Merkit: a small pill with an icon and a count, no words at rest.
      const pillBox = await pill.boundingBox();
      if (!pillBox) throw new Error("Pill is not laid out");
      expect(pillBox.height).toBeLessThanOrEqual(32);
      expect(pillBox.width).toBeLessThanOrEqual(80);
      await expect(pill).toHaveAttribute("data-count", "1");
      await pill.click();
      await expect(strip.getByTestId("background-tab-process")).toHaveAttribute(
        "aria-selected",
        "true",
      );
      await expect(
        strip
          .getByTestId(/^(stop-process|process-stop)$/)
          .and(page.locator(':not([data-force="true"])')),
      ).toBeVisible();
      const fold = strip.getByTestId("ended-runs");
      if ((await fold.getAttribute("aria-expanded")) !== "true")
        await fold.click();
      await expect(strip.getByTestId("clear-finished-processes")).toBeVisible();
      // No promise about closing the browser anywhere (Jari 16.10.2026).
      await expect(strip).toBeVisible();
      await strip
        .getByTestId("process-open")
        .and(page.locator(`[data-process-id="${finished.id}"]`))
        .click();
      const window = page.getByTestId("process-dialog");
      const output = window.getByTestId("process-output");
      await expect(output).toBeVisible();
      expect(
        await output.evaluate((el) => ({
          scrolls:
            el.scrollHeight > el.clientHeight &&
            el.scrollWidth > el.clientWidth,
          bounded: el.clientHeight <= 240,
          distinctSurface:
            getComputedStyle(el).backgroundColor !==
            getComputedStyle(el.closest(".ah-dialog") as HTMLElement)
              .backgroundColor,
          mono: getComputedStyle(el).fontFamily.includes("Mono"),
        })),
      ).toEqual({
        scrolls: true,
        bounded: true,
        distinctSurface: true,
        mono: true,
      });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      expect(
        (await new AxeBuilder({ page }).include(".ah-process-window").analyze())
          .violations,
      ).toEqual([]);
      await window.getByTestId(/^(close|dialog-close|process-close)$/).click();
      await expect(window).toHaveCount(0);
      await expect(composer).toBeInViewport();
      expect(
        (await new AxeBuilder({ page }).include(".ah-bg-strip").analyze())
          .violations,
      ).toEqual([]);
    }
});

test("@process-tray recognised waits stay out of the process list, and clearing finished processes leaves running work and spinoffs", async ({
  page,
}) => {
  const inventory = structuredClone(inventoryFixture) as ProcessInventory;
  inventory.interrupted = [];
  const ordinary = inventory.processes[0];
  // A command mentioning Taskfleet is not recognition: only native run_ids are.
  ordinary.command_preview = "echo 'taskfleet run wait is not this process'";
  const finished = {
    ...ordinary,
    id: "finished",
    process_token: "pt_finished",
    name: "valmis-testi",
    status: "exited" as const,
    ended_at: Date.now(),
    exit_code: 0,
  };
  const runID = "01m521vczarx5bkx086n64t1t2";
  inventory.processes.push(
    finished,
    ...["running", "exited"].map((status, i) => ({
      ...ordinary,
      id: `wait_${i}`,
      process_token: `pt_wait_${i}`,
      name: `odota-spinoff-${i}`,
      command_preview: `taskfleet run wait ${runID} --output json`,
      status: status as "running" | "exited",
      run_ids: [runID],
      // No spinoff enrichment: a failed run-show must not resurrect duplicates.
    })),
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
            run_id: runID,
            title: "UI hidas spinoff",
            created_at: "2026-10-16T10:00:05Z",
            state: "working",
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
  let clears = 0;
  await page.route("**/api/v1/conversations/*/processes**", async (route) => {
    if (route.request().url().endsWith("/clear-finished")) {
      expect(route.request().postDataJSON()).toEqual({
        owner_generation: "og_example",
      });
      expect(route.request().headers()["x-agent-host-csrf"]).toBeTruthy();
      clears++;
      inventory.processes = inventory.processes.filter(
        (p) => p.status === "running",
      );
      await route.fulfill({ json: { schema_version: 1, result: "cleared" } });
    } else await route.fulfill({ json: inventory });
  });
  await page.request.get("/fixture/scenario?value=ready");
  await page.goto("/workspaces");
  await page.getByTestId("github-sign-in").click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
  await page
    .getByRole("navigation")
    .getByTestId("workspace-ordinary-dir")
    .click();
  await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
  const strip = page.getByTestId("background-work");
  const pill = strip.getByTestId("background-processes");
  await expect(pill).toHaveAccessibleName(
    "Prosessit: 1 käynnissä, agentti odottaa: testit, 1 päättynyt",
  );
  await pill.click();
  const panel = strip.getByRole("tabpanel");
  await expect(
    panel
      .getByTestId("process-open")
      .and(page.locator(`[data-process-id="${ordinary.id}"]`)),
  ).toBeVisible();
  await panel.getByTestId("ended-runs").click();
  await expect(
    panel
      .getByTestId("process-open")
      .and(page.locator(`[data-process-id="${finished.id}"]`)),
  ).toBeVisible();
  // The wait is its spinoff's bell, never a process.
  await expect(panel).not.toContainText("odota-spinoff");
  await expect(panel).not.toContainText(runID);
  await panel.getByTestId("clear-finished-processes").click();
  expect(clears).toBe(1);
  await expect(strip.getByTestId("clear-finished-processes")).toHaveCount(0);
  await expect(pill).toHaveAccessibleName(/^Prosessit: 1 käynnissä/);
  // Only the native waiter remains: no empty process pill, and the spinoff
  // (not cleared by Poista päättyneet) carries the wait.
  inventory.processes = inventory.processes.filter((p) => p.run_ids.length);
  await expect(pill).toHaveCount(0);
  const spin = strip.getByTestId("background-spinoffs");
  // The count is a fact; the run title is native content and stays as is.
  await expect(spin).toHaveAttribute("data-working", "1");
  await expect(spin).toHaveAccessibleName(/UI hidas spinoff$/);
  await spin.click();
  await expect(strip.getByTestId("spinoff-UI hidas spinoff")).toBeVisible();
  await expect(strip.getByTestId("stop-wait")).toBeVisible();
});

// Real gateway, controller and fake Pi; no process route is mocked. The fake
// Pi leaves a native process start in its branch, the daemon restarts, and
// the tray reads what was cut off from that branch while Pi is not running.
test("@process-tray a process cut off by a daemon restart shows as ended by the restart", async ({
  page,
}) => {
  test.setTimeout(90000);
  expect(
    (await page.request.get("/fixture/conversations-reset")).status(),
  ).toBe(204);
  await page.request.get("/fixture/scenario?value=ready");
  await page.goto("/workspaces");
  await page.getByTestId("github-sign-in").click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
  await page
    .getByRole("navigation")
    .getByTestId("workspace-ordinary-dir")
    .click();
  await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
  const editor = page.getByTestId("message-input");
  await editor.fill("käynnistä taustaprosessi");
  await page
    .getByTestId("send")
    .and(page.locator('[data-mode="send"]'))
    .click();
  await expectNativeContent(
    page,
    'Selvä. Kysyit: "käynnistä taustaprosessi".',
    { timeout: 20000 },
  );
  const tray = page.getByTestId("background-work");
  // A process of the running Pi is never presented as cut off.
  await expect(tray.getByTestId("disconnected-processes")).toHaveCount(0);
  expect((await page.request.get("/fixture/daemon-restart")).status()).toBe(
    204,
  );
  await page.reload();
  await expect(editor).toBeEnabled({ timeout: 20000 });
  await tray.getByTestId("background-processes").click();
  const row = tray.getByTestId("disconnected-processes");
  await expectNativeContent(row, "kehityspalvelin", {});
  await expect(row).toBeVisible();
  await expectNativeContent(row, "npm run dev", {});
  await expect(row.getByRole("button")).toHaveCount(0);
  const accessibility = await new AxeBuilder({ page })
    .include(".ah-bg-strip")
    .analyze();
  expect(accessibility.violations).toEqual([]);
});

// Resolve native conversation identity from the host, not translated link copy.

// Native content is asserted independently of translated controls. This helper
// only reads rendered content; it never finds an element for an interaction.
async function expectNativeContent(
  scope: import("@playwright/test").Page | import("@playwright/test").Locator,
  expected: string | RegExp,
  options: {
    count?: number;
    visible?: boolean;
    exact?: boolean;
    timeout?: number;
  } = {},
) {
  const { count, visible = true, exact = false, timeout } = options;
  const read = () =>
    scope.locator("*").evaluateAll(
      (nodes, args) => {
        const normalize = (text: string) => text.replace(/\s+/g, " ").trim();
        const matches = (node: Element) => {
          if (["SCRIPT", "STYLE", "HEAD"].includes(node.tagName)) return false;
          const text = normalize(node.textContent ?? "");
          return args.regex
            ? new RegExp(args.regex, args.flags).test(text)
            : args.exact
              ? text === normalize(args.text)
              : text.includes(normalize(args.text));
        };
        return nodes.filter(
          (node) =>
            matches(node) &&
            ![...node.children].some(matches) &&
            (!args.visible ||
              (node.getClientRects().length > 0 &&
                getComputedStyle(node).visibility !== "hidden")),
        ).length;
      },
      {
        text: typeof expected === "string" ? expected : "",
        regex: expected instanceof RegExp ? expected.source : "",
        flags: expected instanceof RegExp ? expected.flags : "",
        exact,
        visible,
      },
    );
  if (count === undefined)
    await expect.poll(read, { timeout }).toBeGreaterThan(0);
  else await expect.poll(read, { timeout }).toBe(count);
}
