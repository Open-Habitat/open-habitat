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
test("@process-tray @a11y follows bounded output, handles stale controls, and keeps the composer reachable", async ({
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
  await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
  await page.getByRole("link", { name: "Alice" }).click();
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "ordinary-dir" })
    .click();
  await page.getByRole("button", { name: "Aloita uusi Pi-keskustelu" }).click();
  const tray = page.getByRole("complementary", { name: "Agentin prosessit" });
  await tray.getByRole("button", { name: /Prosessit ·/ }).click();
  await tray.getByRole("button", { name: "testit", exact: true }).click();
  await expect(tray.getByText(/ensimmäinen loppuosa/)).toBeVisible();
  await tray.getByRole("button", { name: "Pysäytä seuraaminen" }).click();
  tail = "uusi loppuosa";
  await expect(tray.getByText(/ensimmäinen loppuosa/)).toBeVisible();
  await tray.getByRole("button", { name: "Seuraa loppua" }).click();
  await expect(tray.getByText(/uusi loppuosa/)).toBeVisible();
  await tray.getByRole("button", { name: "Pysäytä", exact: true }).click();
  await tray.getByRole("button", { name: "Pakota lopetus" }).click();
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
    .include(".ah-process-tray")
    .analyze();
  expect(accessibility.violations).toEqual([]);
  await tray.getByRole("button", { name: "Poista päättyneet" }).click();
  await expect(tray).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole("textbox", { name: "Viesti Pi:lle" }),
  ).toBeInViewport();
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
  await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
  await page.getByRole("link", { name: "Alice" }).click();
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "ordinary-dir" })
    .click();
  await page.getByRole("button", { name: "Aloita uusi Pi-keskustelu" }).click();
  await expect(
    page.getByRole("button", { name: "Prosessilaajennusta ei ole" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Ei prosesseja" })).toHaveCount(
    0,
  );
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
  await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
  await page.getByRole("link", { name: "Alice" }).click();
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "ordinary-dir" })
    .click();
  await page.getByRole("button", { name: "Aloita uusi Pi-keskustelu" }).click();
  const header = page.locator(".ah-agent-header");
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Päivitä", exact: true })
    .click();
  await expect(
    header.getByRole("button", { name: /Odottaa prosessia.*testit/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /haku · valmis · koodi 0/ }),
  ).toBeVisible();
  await expect(page.locator(".ah-recap-activity")).toContainText(
    "Odotan testit",
  );
  await header.getByRole("button", { name: /Odottaa prosessia/ }).click();
  await expect(
    page.getByText("Synthetic output", { exact: true }),
  ).toBeVisible();
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
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Päivitä", exact: true })
    .click();
  await expect(
    header.getByRole("button", {
      name: /Odottaa spinoffia.*README.*Työskentelee/,
    }),
  ).toBeVisible();
  const waitingRow = page.locator(".ah-waiting-spinoff");
  await expect(waitingRow).toHaveCount(1);
  expect(
    await waitingRow
      .locator(".ah-sidebar-agent-row")
      .evaluate((el) => getComputedStyle(el, "::after").animationName),
  ).toBe("ah-spinoff-blink");
  const agentUrl = page.url();
  await page.getByRole("link", { name: "Etusivu", exact: true }).click();
  await expect(page.locator(".ah-home-head")).toContainText(
    "1 odottaa prosessia tai spinoffia",
  );
  await expect(
    page.locator(".ah-home-card").filter({ hasText: "Prosessikoe" }),
  ).toContainText("Odottaa spinoffia");
  phase = "question";
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Päivitä", exact: true })
    .click();
  await expect(
    page
      .locator(".ah-home-card")
      .filter({ hasText: "Prosessikoe" })
      .getByRole("link", { name: "Vastaa →" }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("navigation")
      .getByRole("link", { name: "Prosessikoe", exact: true }),
  ).toContainText("Odottaa sinua");
  await expect(page.locator(".ah-home-head")).not.toContainText(
    "odottaa prosessia tai spinoffia",
  );
  phase = "working";
  await page.goto(agentUrl);
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Päivitä", exact: true })
    .click();
  await expect(header.getByText("Työskentelee", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Keskeytä", exact: true }),
  ).toBeVisible();
  await expect(
    header.getByRole("button", { name: /Odottaa spinoffia/ }),
  ).toHaveCount(0);
});

// Agreed Kentän yllä dimensions are independent of the implementation: a quiet
// 34px bar, a bounded conversation column and a separately scrolling output.
// Exercise the built bundle: a missing import or the former minimal CSS must fail.
test("@process-tray @a11y compact tray, inventory and output match the selected layout in both themes and widths", async ({
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
  await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
  await page.getByRole("link", { name: "Alice" }).click();
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "ordinary-dir" })
    .click();
  await page.getByRole("button", { name: "Aloita uusi Pi-keskustelu" }).click();
  const tray = page.getByRole("complementary", { name: "Agentin prosessit" });
  const bar = tray.getByRole("button", { name: /Prosessit ·/ });
  const composer = page.getByRole("textbox", { name: "Viesti Pi:lle" });
  for (const width of [1280, 390])
    for (const theme of ["light", "dark"]) {
      await page.setViewportSize({ width, height: 900 });
      await page.evaluate((theme) => {
        document.documentElement.dataset.theme = theme;
      }, theme);
      if ((await bar.getAttribute("aria-expanded")) === "true")
        await bar.click();
      const barBox = await bar.boundingBox();
      if (!barBox) throw new Error("Bar is not laid out");
      expect(barBox.height).toBeLessThanOrEqual(40);
      expect(barBox.width).toBeLessThanOrEqual(780);
      await bar.click();
      const group = tray.getByRole("region", { name: "Päättyneet" });
      expect(
        await group
          .getByRole("heading")
          .evaluate((el) => parseFloat(getComputedStyle(el).fontSize)),
      ).toBeLessThanOrEqual(13);
      await expect(
        tray.getByRole("button", { name: "Poista päättyneet" }),
      ).toBeVisible();
      await expect(
        tray.getByRole("button", { name: "Pysäytä", exact: true }),
      ).toBeVisible();
      const select = tray.getByRole("button", {
        name: finished.name,
        exact: true,
      });
      if ((await select.getAttribute("aria-expanded")) !== "true")
        await select.click();
      const output = tray.getByLabel("Prosessin tuloste");
      await expect(output).toBeVisible();
      expect(
        await output.evaluate((el) => ({
          scrolls:
            el.scrollHeight > el.clientHeight &&
            el.scrollWidth > el.clientWidth,
          bounded: el.clientHeight <= 240,
          distinctSurface:
            getComputedStyle(el).backgroundColor !==
            getComputedStyle(
              el.closest("aside")?.querySelector("button") as HTMLElement,
            ).backgroundColor,
          mono: getComputedStyle(el).fontFamily.includes("Mono"),
        })),
      ).toEqual({
        scrolls: true,
        bounded: true,
        distinctSurface: true,
        mono: true,
      });
      await expect(composer).toBeInViewport();
      const outputBox = await output.boundingBox();
      const composerBox = await composer.boundingBox();
      if (!outputBox || !composerBox) throw new Error("Missing layout");
      expect(outputBox.y + outputBox.height).toBeLessThan(composerBox.y);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      expect(
        (await new AxeBuilder({ page }).include(".ah-process-tray").analyze())
          .violations,
      ).toEqual([]);
    }
});

test("@process-tray recognised waits stay out of the tray and collapsed cleanup preserves running work", async ({
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
  await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
  await page.getByRole("link", { name: "Alice" }).click();
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "ordinary-dir" })
    .click();
  await page.getByRole("button", { name: "Aloita uusi Pi-keskustelu" }).click();
  const tray = page.getByRole("complementary", { name: "Agentin prosessit" });
  const bar = tray.getByRole("button", { name: /Prosessit ·/ });
  await expect(bar).toContainText("1 käynnissä");
  await expect(bar).toContainText("1 päättynyt");
  await bar.click();
  await expect(
    tray.getByRole("button", { name: ordinary.name, exact: true }),
  ).toBeVisible();
  await expect(
    tray.getByRole("button", { name: finished.name, exact: true }),
  ).toBeVisible();
  await expect(tray).not.toContainText("odota-spinoff");
  await expect(tray).not.toContainText(runID);
  await bar.click();
  await expect(bar).toHaveAttribute("aria-expanded", "false");
  await tray.getByRole("button", { name: "Poista päättyneet" }).click();
  expect(clears).toBe(1);
  await expect(
    tray.getByRole("button", { name: "Poista päättyneet" }),
  ).toHaveCount(0);
  await expect(bar).toContainText("1 käynnissä");
  // Only the native waiter remains: no empty/zero-process tray.
  inventory.processes = inventory.processes.filter((p) => p.run_ids.length);
  await expect(tray).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /UI hidas spinoff.*Työskentelee/ }),
  ).toBeVisible();
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
  await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
  await page.getByRole("link", { name: "Alice" }).click();
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "ordinary-dir" })
    .click();
  await page.getByRole("button", { name: "Aloita uusi Pi-keskustelu" }).click();
  const editor = page.getByRole("textbox", { name: "Viesti Pi:lle" });
  await editor.fill("käynnistä taustaprosessi");
  await page.getByRole("button", { name: "Lähetä", exact: true }).click();
  await expect(
    page.getByText('Selvä. Kysyit: "käynnistä taustaprosessi".'),
  ).toBeVisible({ timeout: 20000 });
  const tray = page.getByRole("complementary", { name: "Agentin prosessit" });
  // A process of the running Pi is never presented as cut off.
  await expect(tray.getByText(/katkesi/)).toHaveCount(0);
  expect((await page.request.get("/fixture/daemon-restart")).status()).toBe(
    204,
  );
  await page.reload();
  await expect(editor).toBeEnabled({ timeout: 20000 });
  await tray.getByRole("button", { name: "Prosessit · 1 katkesi" }).click();
  const row = tray.getByRole("region", { name: "Katkenneet" });
  await expect(row.getByText("kehityspalvelin")).toBeVisible();
  await expect(
    row.getByText(/Katkesi palvelimen uudelleenkäynnistyksessä/),
  ).toBeVisible();
  await expect(row.getByText("npm run dev")).toBeVisible();
  await expect(row.getByRole("button")).toHaveCount(0);
  const accessibility = await new AxeBuilder({ page })
    .include(".ah-process-tray")
    .analyze();
  expect(accessibility.violations).toEqual([]);
});
