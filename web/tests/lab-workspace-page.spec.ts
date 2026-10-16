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
for (const width of [1440, 390]) {
  test(`@workspace-page @a11y Git layer, menu and direct creation at ${width}px`, async ({
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
    const menu = page.locator("main").getByRole("button", {
      name: "Työtilan aurinkokello toiminnot",
      exact: true,
    });
    await menu.click();
    await expect(
      page.getByRole("menuitem", {
        name: /^Poista työtila/,
      }),
    ).toBeDisabled();
    await page
      .getByRole("menuitem", { name: "Muuta näyttönimeä…", exact: true })
      .click();
    const rename = page.getByRole("dialog", {
      name: "Muuta näyttönimeä",
      exact: true,
    });
    await expect(
      rename.getByRole("textbox", { name: "Näyttönimi" }),
    ).toHaveValue("aurinkokello");
    await page.keyboard.press("Escape");
    await expect(menu).toBeFocused();
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
  await page
    .getByRole("navigation")
    .getByRole("button", {
      name: "Työtilan aurinkokello toiminnot",
      exact: true,
    })
    .click();
  await page
    .getByRole("menuitem", { name: "Muuta näyttönimeä…", exact: true })
    .click();
  const rename = page.getByRole("dialog", {
    name: "Muuta näyttönimeä",
    exact: true,
  });
  await rename.getByRole("textbox", { name: "Näyttönimi" }).fill("Uusi nimi");
  await rename.getByRole("button", { name: "Tallenna", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Uusi nimi", exact: true }),
  ).toBeVisible();
  await page
    .locator("main")
    .getByRole("button", { name: "Työtilan Uusi nimi toiminnot", exact: true })
    .click();
  await page
    .getByRole("menuitem", { name: "Piilota sivupalkista", exact: true })
    .click();
  await expect(page).toHaveURL(/\/workspaces$/);
  await expect(
    page
      .getByRole("navigation")
      .getByRole("link", { name: "Uusi nimi", exact: true }),
  ).toHaveCount(0);
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
