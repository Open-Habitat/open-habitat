import { expect, test } from "@playwright/test";

test("@lab real controller creates and persists a fake-Pi turn", async ({
  page,
}) => {
  await page.goto("/workspaces");
  await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
  await page.getByRole("link", { name: "Alice" }).click();
  await expect(
    page.getByRole("navigation").getByRole("link", { name: "aurinkokello" }),
  ).toBeVisible();
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "aurinkokello" })
    .click();
  await page.goto("/agents/pi:a1a1a1a1-0000-4000-8000-000000000001");
  await expect(
    page
      .locator("main")
      .getByRole("heading", { name: /Lisää komentoriville --json-lippu/ }),
  ).toBeVisible();
  await page
    .locator("main")
    .getByRole("link", { name: "aurinkokello" })
    .click();
  await page.getByRole("button", { name: "Aloita uusi Pi-keskustelu" }).click();
  const editor = page.getByRole("textbox", { name: "Viesti Pi:lle" });
  await expect(editor).toBeVisible();
  const agent = new URL(page.url()).searchParams.get("conversation");
  expect(agent).toMatch(/^pi:/);
  await editor.fill("Tutki synteettinen työtila");
  await page.getByRole("button", { name: "Lähetä", exact: true }).click();
  await expect(
    page.getByText("Tutki synteettinen työtila", { exact: true }),
  ).toBeVisible({ timeout: 20000 });
  await expect(page.getByText("Katson ensin, mitä työtilassa on.")).toBeVisible(
    { timeout: 20000 },
  );
  await expect(page.getByText("Selvä. Kysyit:", { exact: false })).toBeVisible({
    timeout: 20000,
  });
  await page.getByRole("button", { name: /bash.*Tulos valmis/ }).click();
  await expect(
    page.getByText("README.md", { exact: false }).last(),
  ).toBeVisible();
  await expect(page.getByText("Viimeisimmät live-tapahtumat")).toHaveCount(0);
  await editor.fill("hylkää");
  await page.getByRole("button", { name: "Lähetä", exact: true }).click();
  await expect(
    page.getByText("Viesti hylättiin.", { exact: false }),
  ).toBeVisible({ timeout: 20000 });
  await expect(editor).toHaveValue("hylkää");
  await expect(
    page.getByRole("button", { name: "Lähetä", exact: true }),
  ).toBeEnabled();
  await editor.fill("hidas toinen viesti");
  await page.getByRole("button", { name: "Lähetä", exact: true }).click();
  await expect(page.getByText("Pi työskentelee…", { exact: true })).toBeVisible(
    { timeout: 20000 },
  );
  await expect(
    page.getByText('Selvä. Kysyit: "hidas toinen viesti".', { exact: false }),
  ).toBeVisible({ timeout: 30000 });
  await page.reload();
  await expect(
    page.getByText('Selvä. Kysyit: "hidas toinen viesti".', { exact: false }),
  ).toBeVisible();
  const navLink = page
    .getByRole("navigation", { name: "Työtilat ja keskustelut" })
    .getByRole("link", { name: /Tutki synteettinen työtila/ })
    .last();
  await expect(navLink).toBeVisible();
  await expect(navLink).toHaveAttribute(
    "href",
    new RegExp(`conversation=${agent}`),
  );
  await page
    .getByRole("link", { name: "aurinkokello", exact: true })
    .last()
    .click();
  await navLink.click();
  await expect(
    page.getByRole("textbox", { name: "Viesti Pi:lle" }),
  ).toBeVisible();
  const snapshot = await (await page.request.get("/api/v1/snapshot")).json();
  expect(
    snapshot.agents.some(
      (entry: { agent_id: string }) => entry.agent_id === agent,
    ),
  ).toBe(true);
});

test("@lab fresh replies remain visible across native history pages", async ({
  page,
}) => {
  await page.goto("/workspaces");
  await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
  await page.getByRole("link", { name: "Alice" }).click();
  await page
    .getByRole("navigation", { name: "Työtilat ja keskustelut" })
    .getByRole("link", { name: "aurinkokello" })
    .click();
  await page.getByRole("button", { name: "Aloita uusi Pi-keskustelu" }).click();
  const editor = page.getByRole("textbox", { name: "Viesti Pi:lle" });
  for (let i = 1; i <= 8; i++) {
    await editor.fill(`Kierros ${i}`);
    await page.getByRole("button", { name: "Lähetä", exact: true }).click();
    await expect(page.getByText(`Kierros ${i}`, { exact: true })).toBeVisible({
      timeout: 20000,
    });
    await expect(
      page.getByText(`Selvä. Kysyit: "Kierros ${i}".`, { exact: false }),
    ).toBeVisible({ timeout: 30000 });
    await expect(
      page.getByRole("button", { name: "Lähetä", exact: true }),
    ).toBeEnabled({ timeout: 30000 });
  }
  await expect(page.getByText("Kierros 8", { exact: true })).toBeVisible();
});

test("@lab fake-Pi crash leaves the turn readable but blocks another send", async ({
  page,
}) => {
  await page.goto("/workspaces");
  await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
  await page.getByRole("link", { name: "Alice" }).click();
  await page
    .getByRole("navigation", { name: "Työtilat ja keskustelut" })
    .getByRole("link", { name: "aurinkokello" })
    .click();
  await page.getByRole("button", { name: "Aloita uusi Pi-keskustelu" }).click();
  const editor = page.getByRole("textbox", { name: "Viesti Pi:lle" });
  await editor.fill("kaadu nyt");
  await page.getByRole("button", { name: "Lähetä", exact: true }).click();
  await expect(page.getByText("kaadu nyt", { exact: true })).toBeVisible({
    timeout: 20000,
  });
  await expect(page.getByText("Tila epävarma")).toBeVisible({ timeout: 20000 });
  await expect(
    page.getByRole("button", { name: "Lähetä", exact: true }),
  ).toBeDisabled();
  await page.reload();
  await expect(page.getByRole("heading", { level: 1, name: "kaadu nyt" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Lähetä", exact: true }),
  ).toBeDisabled();
});
