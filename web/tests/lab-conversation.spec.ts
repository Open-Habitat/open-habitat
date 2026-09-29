import { expect, test } from "@playwright/test";

test("@lab real controller creates and persists a fake-Pi turn", async ({
  page,
}) => {
  await page.goto("/workspaces");
  await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
  await page.getByRole("link", { name: "Alice" }).click();
  await expect(page.getByRole("link", { name: "aurinkokello" })).toBeVisible();
  await page.getByRole("link", { name: "aurinkokello" }).click();
  await page.goto("/agents/pi:a1a1a1a1-0000-4000-8000-000000000001");
  await expect(
    page.getByText("Lisää komentoriville --json-lippu", { exact: false }),
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
  await expect(
    page.getByText("README.md", { exact: false }).last(),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByText("Selvä. Kysyit:", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Avaa aurinkokello" }).click();
  await expect(
    page
      .getByRole("navigation", { name: "Workspacet ja agentit" })
      .getByRole("link", { name: /Tutki synteettinen työtila|Uusi keskustelu/ })
      .last(),
  ).toBeVisible();
  const snapshot = await (await page.request.get("/api/v1/snapshot")).json();
  expect(
    snapshot.agents.some(
      (entry: { agent_id: string }) => entry.agent_id === agent,
    ),
  ).toBe(true);
});
