import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "./lab-host";

async function openWorkspace(page: import("@playwright/test").Page) {
  await page.goto("/workspaces");
  await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
  await page.getByRole("link", { name: "Alice", exact: true }).click();
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "aurinkokello", exact: true })
    .click();
}
for (const width of [1440, 900, 390]) {
  test(`@workspace-page @a11y Git layer, icons and direct creation at ${width}px`, async ({
    page,
  }) => {
    await openWorkspace(page);
    await page.setViewportSize({ width, height: 900 });
    const pill = page.getByRole("button", {
      name: "main · 2 muutosta ↑1",
      exact: true,
    });
    await expect(pill).toBeVisible();
    const workspaceId = new URL(page.url()).pathname.split("/").at(-1);
    const facts = await page.request.get(
      `/api/v1/workspaces/git?workspace_id=${workspaceId}`,
      { headers: { "X-Agent-Host-Identity": "wid_forged" } },
    );
    expect(facts.status()).toBe(200);
    expect((await facts.json()).workspace_id).toBe(workspaceId);
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
    const git = page.getByRole("dialog", {
      name: "Git · aurinkokello",
      exact: true,
    });
    await expect(git).toContainText("origin/main · 1 edellä · 0 jäljessä");
    await expect(git).toContainText("main.go");
    await expect(git).toContainText("go.mod");
    await expect(git).toContainText("Erota statusrivien jäsennin");
    await expect(git.getByText("paikallinen", { exact: true })).toHaveCount(1);
    const result = await new AxeBuilder({ page }).analyze();
    expect(
      result.violations.filter((v) =>
        ["serious", "critical"].includes(v.impact ?? ""),
      ),
    ).toEqual([]);
    await page.keyboard.press("Escape");
    await expect(pill).toBeFocused();
    const renameButton = page
      .locator("main")
      .getByRole("button", { name: "Muuta näyttönimeä…", exact: true });
    const deletion = page
      .locator("main")
      .getByRole("button", { name: "Poista työtila…", exact: true });
    await expect(deletion).toBeEnabled();
    await renameButton.click();
    const rename = page.getByRole("dialog", {
      name: "Muuta näyttönimeä",
      exact: true,
    });
    await expect(
      rename.getByRole("textbox", { name: "Näyttönimi" }),
    ).toHaveValue("aurinkokello");
    await page.keyboard.press("Escape");
    await expect(renameButton).toBeFocused();
    if (width <= 900) {
      const buttons = await page
        .locator(".ah-workspace-icon-row button")
        .evaluateAll((nodes) =>
          nodes.map((n) => ({
            width: n.getBoundingClientRect().width,
            height: n.getBoundingClientRect().height,
          })),
        );
      for (const box of buttons) {
        expect(box.width).toBeGreaterThanOrEqual(40);
        expect(box.height).toBeGreaterThanOrEqual(40);
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
      .getByRole("button", { name: "Aloita uusi Pi-keskustelu", exact: true })
      .click();
    await expect(
      page.getByRole("textbox", { name: "Viesti Pi:lle" }),
    ).toBeVisible();
    expect(creates).toBe(1);
    await expect(page.getByRole("menu")).toHaveCount(0);
  });
}

test("@workspace-page sidebar plus creates directly; rename and hide use current native observations", async ({
  page,
}) => {
  await openWorkspace(page);
  await page
    .getByRole("navigation")
    .getByRole("button", {
      name: "Uusi keskustelu työtilassa aurinkokello",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Viesti Pi:lle" }),
  ).toBeVisible();
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "aurinkokello", exact: true })
    .click();
  const row = page.locator(".ah-rail-workspace-actions").first();
  await expect(row.getByRole("button")).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: /Työtilan .* toiminnot/ }),
  ).toHaveCount(0);
  await page
    .locator("main")
    .getByRole("button", { name: "Muuta näyttönimeä…", exact: true })
    .click();
  const rename = page.getByRole("dialog", {
    name: "Muuta näyttönimeä",
    exact: true,
  });
  await rename.getByRole("textbox", { name: "Näyttönimi" }).fill("Uusi nimi");
  const renamed = page.waitForResponse(
    (r) =>
      new URL(r.url()).pathname === "/api/v1/workspaces" &&
      !!r.request().postData()?.includes('"settings"'),
  );
  await rename.getByRole("button", { name: "Tallenna", exact: true }).click();
  // The new name shows at once (ADR 0023); the observations below are taken
  // after the host confirmed it and the page followed the workspace's ID.
  await expect(
    page.getByRole("heading", { name: "Uusi nimi", exact: true }),
  ).toBeVisible();
  const { workspace_id } = await (await renamed).json();
  await expect(page).toHaveURL(new RegExp(`/workspaces/${workspace_id}$`));
  const workspaceURL = page.url();
  const titles = await page.locator(".ah-home-card-title").allTextContents();
  expect(titles.length).toBeGreaterThan(0);
  await page
    .locator("main")
    .getByRole("button", { name: "Arkistoi työtila", exact: true })
    .click();
  await expect(page).toHaveURL(workspaceURL);
  await expect(
    page.getByRole("button", { name: "Palauta työtila", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".ah-workspace-hidden")).toContainText(
    "tiedostot ja keskustelut säilyvät",
  );
  await expect(
    page.locator(".ah-workspace").getByRole("link", {
      name: "Uusi nimi",
      exact: true,
    }),
  ).toHaveCount(0);
  await expect(
    page
      .getByRole("region", { name: "Arkistoidut työtilat" })
      .getByRole("link", { name: "Uusi nimi", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".ah-home-card-title")).toHaveText(titles);
  await page.getByRole("button", { name: "Kumoa", exact: true }).click();
  await expect(
    page.locator(".ah-workspace").getByRole("link", {
      name: "Uusi nimi",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Arkistoi työtila", exact: true })
    .click();
  await page.reload();
  await expect(page.locator(".ah-workspace-hidden")).toBeVisible();
  await expect(page.locator(".ah-home-card-title")).toHaveText(titles);
  await page.goto("/workspaces");
  await expect(
    page.locator("main").getByRole("link", { name: "Uusi nimi", exact: true }),
  ).toHaveCount(0);
  await page.goto(workspaceURL);
  await expect(page.locator(".ah-home-card-title")).toHaveText(titles);
  await page
    .getByRole("button", { name: "Palauta työtila", exact: true })
    .click();
  await expect(
    page.locator(".ah-workspace").getByRole("link", {
      name: "Uusi nimi",
      exact: true,
    }),
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
      .filter({ has: page.getByText("uusia viestejä", { exact: true }) })
      .first();
    await expect(card).toBeVisible();
    await expect(card.getByText("Vain luku", { exact: true })).toBeVisible();
    for (const width of [1440, 640, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await page.evaluate(() => document.fonts.ready);
      const boxes = await card.evaluate((node) => {
        const title = node.querySelector(".ah-home-card-head > a");
        const archive = node.querySelector('button[aria-label="Arkistoi"]');
        const stale = node.querySelector(".ah-home-stale");
        if (!title || !archive || !stale)
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
          stale: rect(stale),
        };
      });
      expect(boxes.archive.top).toBeLessThanOrEqual(boxes.title.top + 2);
      expect(boxes.archive.left).toBeGreaterThanOrEqual(boxes.title.right + 4);
      expect(boxes.archive.right).toBeGreaterThan(
        boxes.card.left + boxes.card.width * 0.75,
      );
      expect(boxes.archive.right).toBeLessThanOrEqual(boxes.card.right);
      expect(boxes.archive.bottom).toBeLessThanOrEqual(boxes.stale.top + 1);
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
  await openWorkspace(page);
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const response = await page.request.get("/api/v1/snapshot");
  const body = await response.json();
  const workspace = body.workspaces.find((w: { workspace_id: string }) =>
    page.url().endsWith(w.workspace_id),
  );
  await page.getByRole("button", { name: "Kopioi polku", exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toBe(workspace.path);
  await context.route("https://github.com/**", (route) =>
    route.fulfill({ body: "Synthetic GitHub destination" }),
  );
  const popup = context.waitForEvent("page");
  await page
    .getByRole("button", { name: "Avaa GitHubissa", exact: true })
    .click();
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
      .getByRole("button", { name: "Arkistoi", exact: true });
    if (next === "idle") await expect(archive).toBeEnabled();
    else {
      await expect(archive).toBeDisabled();
      await expect(archive).toHaveAccessibleDescription(
        next === "working"
          ? "Odota Pi:n vuoron päättymistä."
          : "Odota prosessin tai spinoffin valmistumista ja agentin vuoron päättymistä.",
      );
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
  const card = page.locator(".ah-home-card").first();
  const title = await card.locator(".ah-home-card-title").innerText();
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
  await card.getByRole("button", { name: "Arkistoi", exact: true }).click();
  const notice = page.locator(".ah-archive-notice");
  await expect(notice).toContainText(`Arkistoitu ${title}`);
  await expect(
    page.locator(".ah-home-card-title").filter({ hasText: title }),
  ).toHaveCount(0);
  await notice.getByRole("button", { name: "Palauta", exact: true }).click();
  await expect(
    page.locator(".ah-home-card-title").filter({ hasText: title }),
  ).toBeVisible();
  await expect(page).toHaveURL(original);
  expect(starts).toBe(0);
});
