import AxeBuilder from "@axe-core/playwright";
import { hostOrigin } from "../test-ports.mjs";
import { expect, test } from "./worker-host";

test.use({ baseURL: hostOrigin, ignoreHTTPSErrors: true });
test("@file-tool-cards live and saved file rows retain counts, content and accessible diff", async ({
  page,
}) => {
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
  await page
    .getByRole("textbox", { name: "Viesti Pi:lle" })
    .fill("näytä kortit");
  await page.getByRole("button", { name: "Lähetä", exact: true }).click();
  const tool = (name: string) =>
    page
      .locator(".ah-tool-row")
      .filter({ has: page.locator(".ah-tool-name", { hasText: name }) })
      .first();
  await expect(tool("read")).toContainText("2 riviä", { timeout: 25000 });
  await expect(tool("write")).toContainText("uusi · 1 riviä");
  await expect(tool("edit")).toContainText("+1 −1");
  await page.reload();
  for (const name of ["read", "write", "edit"])
    await tool(name).locator("button").first().click();
  await expect(
    tool("read").getByRole("button", { name: "Kopioi sisältö" }),
  ).toBeVisible();
  await expect(tool("write").getByText("typescript")).toBeVisible();
  await expect(tool("edit").locator("del")).toHaveText("2");
  await expect(tool("edit").locator("ins")).toHaveText("3");
  await expect(tool("edit").getByText("poistettu:")).toHaveCount(1);
  await expect(tool("edit").getByText("lisätty:")).toHaveCount(1);
  expect(
    (await new AxeBuilder({ page }).include(".ah-file-diff-box").analyze())
      .violations,
  ).toEqual([]);
});

test("@file-tool-cards failed read shows the native error without a file count", async ({
  page,
}) => {
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
  await page
    .getByRole("textbox", { name: "Viesti Pi:lle" })
    .fill("virhekortti");
  await page.getByRole("button", { name: "Lähetä", exact: true }).click();
  const row = page
    .locator(".ah-tool-row")
    .filter({ has: page.locator(".ah-tool-name", { hasText: "read" }) })
    .first();
  await expect(row).toHaveAttribute("data-state", "failed", { timeout: 25000 });
  await row.locator("button").first().click();
  await expect(row.getByText("ENOENT: missing.ts")).toBeVisible();
  await expect(row.locator(".ah-output-box")).toHaveCount(0);
  await expect(row.locator(".ah-file-stat")).toHaveCount(0);
});
