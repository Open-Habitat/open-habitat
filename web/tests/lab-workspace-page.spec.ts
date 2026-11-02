import AxeBuilder from "@axe-core/playwright";
import { archiveFromConfirmedView } from "./archive-proof";
import { expect, test } from "./lab-host";

async function openWorkspace(
  page: import("@playwright/test").Page,
  name = "aurinkokello",
) {
  await page.goto("/workspaces");
  await page
    .getByRole("button")
    .and(page.getByTestId("github-sign-in"))
    .click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
  await page
    .getByRole("navigation")
    .getByRole("link")
    .and(page.getByTestId(`workspace-${name}`))
    .click();
}
for (const width of [1440, 900, 390]) {
  test(`@workspace-page @a11y Git layer, icons and direct creation at ${width}px`, async ({
    page,
  }) => {
    await openWorkspace(page);
    await page.setViewportSize({ width, height: 900 });
    const pill = page
      .getByRole("button")
      .and(page.getByTestId("workspace-git"));
    await expect(pill).toBeVisible();
    const workspaceId = new URL(page.url()).pathname.split("/").at(-1);
    const facts = await page.request.get(
      `/api/v1/workspaces/git?workspace_id=${workspaceId}`,
      { headers: { "X-Agent-Host-Identity": "wid_forged" } },
    );
    expect(facts.status()).toBe(200);
    const originalGit = await facts.json();
    expect(originalGit.workspace_id).toBe(workspaceId);
    expect(
      (
        await page.request.get(
          `/api/v1/workspaces/git?workspace_id=${workspaceId}&workspace_id=${workspaceId}`,
        )
      ).status(),
    ).toBe(400);
    expect(
      (
        await page.request.get(
          "/api/v1/workspaces/git?workspace_id=ws_missing123",
        )
      ).status(),
    ).toBe(404);
    await pill.click();
    const git = page
      .getByRole("dialog")
      .and(page.getByTestId("workspace-git-dialog"));
    // The same details as the conversation's top bar, inside this layer.
    await expect(git).toContainText("origin/status-rivit");
    await expect(git).toContainText("origin/main");
    await expect(git).toContainText("tests/test_status_rows.py");
    await expect(git).toContainText("+52");
    await git.getByTestId("git-commits-out").first().locator("summary").click();
    await expect(git).toContainText("Statusrivit: --since-suodatus");
    const fetch = git.getByRole("button").and(page.getByTestId("fetch-git"));
    await expect(git.getByRole("button")).toHaveCount(2);
    const close = git.getByRole("button").and(page.getByTestId("dialog-close"));
    const fetchWrites: string[] = [];
    page.on("request", (request) => {
      if (request.url().endsWith("/api/v1/workspaces/git/fetch"))
        fetchWrites.push(request.method());
    });
    const fetched = page.waitForResponse((response) =>
      response.url().endsWith("/api/v1/workspaces/git/fetch"),
    );
    await fetch.click();
    await fetched;
    expect(fetchWrites).toEqual(["POST"]);
    await expect(git.getByRole("status")).toBeVisible();
    // Reobserve native state via the API: Chromium may discard a completed
    // no-store fetch response body before Playwright can retrieve it.
    const afterGit = await (
      await page.request.get(
        `/api/v1/workspaces/git?workspace_id=${workspaceId}`,
      )
    ).json();
    expect(afterGit.branch).toBe(originalGit.branch);
    expect(afterGit.files).toEqual(originalGit.files);
    const controls = await Promise.all(
      [fetch, close].map((button) =>
        button.evaluate((node) => ({
          color: getComputedStyle(node).color,
          height: node.getBoundingClientRect().height,
          top: node.getBoundingClientRect().top,
          bottom: node.getBoundingClientRect().bottom,
          left: node.getBoundingClientRect().left,
          right: node.getBoundingClientRect().right,
        })),
      ),
    );
    // Compact, neutral actions and a separate close row; wrapping must leave
    // breathing room rather than recreate the reported touching controls.
    expect(new Set(controls.map((c) => c.color)).size).toBe(1);
    expect(controls[1].height).toBeLessThanOrEqual(controls[0].height);
    for (let i = 0; i < controls.length; i++) {
      for (let j = i + 1; j < controls.length; j++) {
        const a = controls[i];
        const b = controls[j];
        expect(
          b.left > a.right ||
            a.left > b.right ||
            b.top > a.bottom ||
            a.top > b.bottom,
        ).toBe(true);
      }
    }
    const result = await new AxeBuilder({ page }).analyze();
    expect(
      result.violations.filter((v) =>
        ["serious", "critical"].includes(v.impact ?? ""),
      ),
    ).toEqual([]);
    await close.click();
    await expect(pill).toBeFocused();
    await pill.click();
    await page.keyboard.press("Escape");
    await expect(pill).toBeFocused();
    const renameButton = page
      .locator("main")
      .getByRole("button")
      .and(page.getByTestId("rename-workspace"));
    const deletion = page
      .locator("main")
      .getByRole("button")
      .and(page.getByTestId("delete-workspace"));
    await expect(deletion).toBeEnabled();
    await renameButton.click();
    const rename = page
      .getByRole("dialog")
      .and(page.getByTestId("rename-dialog"));
    await expect(rename.getByRole("textbox")).toHaveValue("aurinkokello");
    await page.keyboard.press("Escape");
    await expect(renameButton).toBeFocused();
    {
      // Row-role icon buttons: 32 px on the desktop, 40 px on the phone.
      const side = width <= 800 ? 40 : 32;
      const buttons = await page
        .locator(".ah-workspace-icon-row button")
        .evaluateAll((nodes) =>
          nodes.map((n) => ({
            width: n.getBoundingClientRect().width,
            height: n.getBoundingClientRect().height,
          })),
        );
      for (const box of buttons) {
        expect(box.width).toBeCloseTo(side, 0);
        expect(box.height).toBeCloseTo(side, 0);
      }
    }
    let creates = 0;
    page.on("request", (request) => {
      if (
        request.method() === "POST" &&
        new URL(request.url()).pathname === "/api/v1/conversations"
      )
        creates++;
    });
    await page
      .locator("main")
      .getByRole("button")
      .and(page.getByTestId("conversation-start"))
      .click();
    await expect(
      page.getByRole("textbox").and(page.getByTestId("message-input")),
    ).toBeVisible();
    expect(creates).toBe(1);
    await expect(page.getByRole("menu")).toHaveCount(0);
  });
}

test("@workspace-page sidebar plus creates directly; rename and hide use current native observations", async ({
  page,
}) => {
  await openWorkspace(page);
  const created = page
    .waitForResponse(
      (r) =>
        r.request().method() === "POST" &&
        new URL(r.url()).pathname === "/api/v1/conversations",
    )
    .then((response) => response.json());
  await page
    .getByRole("navigation")
    .getByRole("button")
    .and(page.getByTestId("workspace-start-aurinkokello"))
    .click();
  await expect(
    page.getByRole("textbox").and(page.getByTestId("message-input")),
  ).toBeVisible();
  const creation = await created;
  // The placeholder is visible before creation's route replacement commits.
  await expect(page).toHaveURL(
    (url) => url.searchParams.get("conversation") === creation.agent_id,
  );
  await page
    .getByRole("navigation")
    .getByRole("link")
    .and(page.getByTestId("workspace-aurinkokello"))
    .click();
  const row = page.locator(".ah-rail-workspace-actions").first();
  await expect(row.getByRole("button")).toHaveCount(1);
  await expect(
    page.getByRole("button").and(page.getByTestId("workspace-menu")),
  ).toHaveCount(0);
  await page
    .locator("main")
    .getByRole("button")
    .and(page.getByTestId("rename-workspace"))
    .click();
  const rename = page
    .getByRole("dialog")
    .and(page.getByTestId("rename-dialog"));
  await rename.getByRole("textbox").fill("Uusi nimi");
  const renamed = page.waitForResponse(
    (r) =>
      new URL(r.url()).pathname === "/api/v1/workspaces" &&
      !!r.request().postData()?.includes('"settings"'),
  );
  await rename
    .getByRole("button")
    .and(page.getByTestId("save-workspace-name"))
    .click();
  // The new name shows at once (ADR 0023); the observations below are taken
  // after the host confirmed it and the page followed the workspace's ID.
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Uusi nimi");
  const { workspace_id } = await (await renamed).json();
  await expect(page).toHaveURL(new RegExp(`/workspaces/${workspace_id}$`));
  const workspaceURL = page.url();
  // Creation can outlive the placeholder composer. Include its confirmed
  // card before taking the list whose persistence this test checks.
  await expect(
    page.getByTestId(`conversation-card-${creation.agent_id}`),
  ).toBeVisible();
  const titles = await page.locator(".ah-home-card-title").allTextContents();
  expect(titles.length).toBeGreaterThan(0);
  await page
    .locator("main")
    .getByRole("button")
    .and(page.getByTestId(/^workspace-(archive|restore)$/))
    .click();
  await expect(page).toHaveURL(workspaceURL);
  await expect(
    page
      .getByRole("button")
      .and(page.getByTestId(/^workspace-(archive|restore)$/)),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".ah-workspace-hidden")).toBeVisible();
  await expect(
    page
      .locator(".ah-workspace")
      .getByRole("link")
      .and(page.getByTestId("workspace-Uusi nimi")),
  ).toHaveCount(0);
  await expect(
    page
      .getByRole("region")
      .and(page.getByTestId("archived-workspaces"))
      .getByRole("link")
      .and(page.getByTestId("workspace-Uusi nimi")),
  ).toBeVisible();
  await expect(page.locator(".ah-home-card-title")).toHaveText(titles);
  await page
    .getByRole("button")
    .and(page.getByTestId("restore-notice"))
    .click();
  await expect(
    page
      .locator(".ah-workspace")
      .getByRole("link")
      .and(page.getByTestId("workspace-Uusi nimi")),
  ).toBeVisible();
  const hidden = page
    .waitForResponse(
      (r) =>
        new URL(r.url()).pathname === "/api/v1/workspaces" &&
        !!r.request().postData()?.includes('"hidden":true'),
    )
    .then((response) => response.json());
  await page
    .getByRole("button")
    .and(page.getByTestId(/^workspace-(archive|restore)$/))
    .click();
  // Optimistic visibility is not evidence that a queued write reached disk.
  await hidden;
  await page.reload();
  await expect(page.locator(".ah-workspace-hidden")).toBeVisible();
  await expect(page.locator(".ah-home-card-title")).toHaveText(titles);
  await page.goto("/workspaces");
  await expect(
    page
      .locator("main")
      .getByRole("link")
      .and(page.getByTestId("workspace-Uusi nimi")),
  ).toHaveCount(0);
  await page.goto(workspaceURL);
  await expect(page.locator(".ah-home-card-title")).toHaveText(titles);
  await page
    .getByRole("button")
    .and(page.getByTestId(/^workspace-(archive|restore)$/))
    .click();
  await expect(
    page
      .locator(".ah-workspace")
      .getByRole("link")
      .and(page.getByTestId("workspace-Uusi nimi")),
  ).toBeVisible();
});

test("@workspace-page archive stays at the card's top right on home and workspace, including narrow/zoom-equivalent views", async ({
  page,
}) => {
  await openWorkspace(page);
  const workspaceURL = page.url();
  const homeURL = new URL("/workspaces", workspaceURL).href;
  for (const route of [workspaceURL, homeURL]) {
    await page.goto(route);
    const card = page
      .locator(".ah-home-card")
      .filter({ has: page.getByTestId("card-read-only") })
      .first();
    await expect(card).toBeVisible();
    await expect(card.getByTestId("card-read-only")).toBeVisible();
    for (const width of [1440, 640, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await page.evaluate(() => document.fonts.ready);
      const boxes = await card.evaluate((node) => {
        const title = node.querySelector(".ah-home-card-head > a");
        const archive = node.querySelector(
          'button[data-testid="archive-conversation"]',
        );
        const meta = node.querySelector(".ah-home-card-meta");
        if (!title || !archive || !meta)
          throw new Error("card geometry fixture missing");
        const rect = (el: Element) => {
          const r = el.getBoundingClientRect();
          return {
            top: r.top,
            bottom: r.bottom,
            left: r.left,
            right: r.right,
            width: r.width,
          };
        };
        return {
          card: rect(node),
          title: rect(title),
          archive: rect(archive),
          meta: rect(meta),
        };
      });
      expect(boxes.archive.top).toBeLessThanOrEqual(boxes.title.top + 2);
      expect(boxes.archive.left).toBeGreaterThanOrEqual(boxes.title.right + 4);
      expect(boxes.archive.right).toBeGreaterThan(
        boxes.card.left + boxes.card.width * 0.75,
      );
      expect(boxes.archive.right).toBeLessThanOrEqual(boxes.card.right);
      expect(boxes.archive.bottom).toBeLessThanOrEqual(boxes.meta.top + 1);
      const widths = await page.evaluate(() => ({
        scroll: document.documentElement.scrollWidth,
        client: document.documentElement.clientWidth,
      }));
      expect(widths.scroll).toBeLessThanOrEqual(widths.client + 1);
    }
  }
});

test("@workspace-page copy uses the full native path and GitHub opens the observed remote", async ({
  page,
  context,
}) => {
  // aurinkokello's origin is a local bare repository (Hae etärepo); kotisivu
  // keeps a GitHub origin.
  await openWorkspace(page, "kotisivu");
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const response = await page.request.get("/api/v1/snapshot");
  const body = await response.json();
  const workspace = body.workspaces.find((w: { workspace_id: string }) =>
    page.url().endsWith(w.workspace_id),
  );
  await page.getByRole("button").and(page.getByTestId("copy-path")).click();
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toBe(workspace.path);
  await context.route("https://github.com/**", (route) =>
    route.fulfill({ body: "Synthetic GitHub destination" }),
  );
  const popup = context.waitForEvent("page");
  await page.getByRole("button").and(page.getByTestId("open-github")).click();
  const destination = await popup;
  await expect(destination).toHaveURL(
    `https://github.com/${workspace.git_summary.github_repo}`,
  );
  expect(await destination.evaluate(() => window.opener === null)).toBe(true);
  await destination.close();
});

test("@workspace-page archive blocks active turns, process waits and spinoff waits without sending a write", async ({
  page,
}) => {
  // Wire-level activity seams: native histories/recaps remain lab-backed.
  let phase: "working" | "process" | "spinoff" | "idle" = "working";
  await page.route("**/api/v1/snapshot", async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    for (const agent of body.agents) {
      agent.process = "daemon_managed_live";
      agent.activity = phase === "working" ? "running" : "idle";
      agent.run_active = phase === "working";
      agent.pending_question = null;
      agent.waiting_on =
        phase === "process" || phase === "spinoff"
          ? [
              {
                process_id: "synthetic-process",
                name: "Vertailuajo",
                kind: phase === "spinoff" ? "taskfleet_wait" : "process",
                run_ids: [],
              },
            ]
          : [];
    }
    await route.fulfill({ response, json: body });
  });
  await openWorkspace(page);
  let writes = 0;
  page.on("request", (request) => {
    if (request.method() === "POST" && request.url().includes("/archive"))
      writes++;
  });
  for (const next of ["working", "process", "spinoff", "idle"] as const) {
    phase = next;
    await page.reload();
    const archive = page
      .locator(".ah-home-card")
      .first()
      .getByRole("button")
      .and(page.getByTestId("archive-conversation"));
    if (next === "idle") await expect(archive).toBeEnabled();
    else {
      await expect(archive).toBeDisabled();
      await archive.press("Enter");
    }
  }
  expect(writes).toBe(0);
  await page.unrouteAll({ behavior: "wait" });
});

test("@workspace-page card archive offers undo on the same page without starting Pi", async ({
  page,
}) => {
  await openWorkspace(page);
  const original = page.url();
  const cardId = await page
    .locator(".ah-home-card")
    .first()
    .getAttribute("data-testid");
  if (!cardId) throw new Error("missing card identity");
  // Native observations may reorder the list; archive the card we identified,
  // not whichever card happens to be first when the click is dispatched.
  const card = page.getByTestId(cardId);
  let starts = 0;
  page.on("request", (request) => {
    if (
      request.method() === "POST" &&
      /\/conversations(?:$|\/[^/]+\/continue)/.test(
        new URL(request.url()).pathname,
      )
    )
      starts++;
  });
  await archiveFromConfirmedView(page, () =>
    card.getByRole("button").and(page.getByTestId("archive-conversation")),
  );
  const notice = page.locator(".ah-archive-notice");
  await expect(notice).toBeVisible();
  await expect(page.getByTestId(cardId)).toHaveCount(0);
  // Another kind stacks: the newest shows, +N opens the rest.
  await page
    .getByRole("button")
    .and(page.getByTestId("workspace-archive"))
    .click();
  const area = page.getByTestId("notice-area").filter({ has: notice });
  const more = area.getByRole("button").and(page.getByTestId("notice-more"));
  await expect(more).toHaveAttribute("aria-expanded", "false");
  await expect(area.locator(".ah-archive-notice:visible")).toHaveCount(1);
  await more.click();
  await expect(area.locator(".ah-archive-notice:visible")).toHaveCount(2);
  // Esc closes only the notice that holds focus, and focus goes back to
  // the page rather than being lost with the row.
  await more.press("Escape");
  await expect(notice).toHaveCount(1);
  await expect(page.locator("main")).toBeFocused();
  await notice
    .getByRole("button")
    .and(page.getByTestId("restore-notice"))
    .click();
  await expect(page.getByTestId(cardId)).toBeVisible();
  await expect(page).toHaveURL(original);
  expect(starts).toBe(0);
});
