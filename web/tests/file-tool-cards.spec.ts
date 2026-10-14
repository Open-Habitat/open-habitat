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
  const savedHistory = page.waitForResponse(
    (response) => response.url().includes("/history?limit=25") && response.ok(),
  );
  await page.reload();
  await savedHistory;
  // Reload can first paint provisional output; wait for the saved native reply
  // before opening its disclosures.
  await expect(page.getByText('Selvä. Kysyit: "näytä kortit".')).toBeVisible();
  for (const name of ["read", "write", "edit"]) {
    await expect(async () => {
      const toggle = tool(name).locator("button").first();
      if ((await toggle.getAttribute("aria-expanded")) !== "true")
        await toggle.click();
      await expect(toggle).toHaveAttribute("aria-expanded", "true", {
        timeout: 750,
      });
    }).toPass({ timeout: 10000 });
  }
  await expect(
    tool("read").getByRole("button", { name: "Kopioi sisältö" }),
  ).toBeVisible();
  await expect(tool("write").getByText("typescript")).toBeVisible();
  await expect(async () => {
    const toggle = tool("edit").locator("button").first();
    if ((await toggle.getAttribute("aria-expanded")) === "false")
      await toggle.click();
    await expect(tool("edit").locator("del")).toHaveText("2");
  }).toPass({ timeout: 15000 });
  await expect(tool("edit").locator("ins")).toHaveText("3");
  await expect(tool("edit").getByText("poistettu:")).toHaveCount(1);
  await expect(tool("edit").getByText("lisätty:")).toHaveCount(1);
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    const geometry = await tool("write").evaluate((node) => {
      const row = node.getBoundingClientRect();
      const marker = node
        .closest(".ah-agent-turn")
        ?.querySelector(".ah-turn-head");
      const reply = node
        .closest(".ah-agent-turn")
        ?.querySelector(".ah-turn-reply .ah-message");
      const inner = node.querySelector(".ah-disclosure-panel");
      return {
        right: row.right,
        markerRight: marker?.getBoundingClientRect().right,
        replyRight: reply?.getBoundingClientRect().right,
        padding: inner ? getComputedStyle(inner).paddingLeft : "",
        replyPadding: reply ? getComputedStyle(reply).paddingLeft : "",
      };
    });
    expect(Math.abs(geometry.right - (geometry.markerRight ?? 0))).toBeLessThan(
      1,
    );
    expect(Math.abs(geometry.right - (geometry.replyRight ?? 0))).toBeLessThan(
      1,
    );
    expect(geometry.padding).toBe(geometry.replyPadding);
  }
  const box = tool("write").locator(".ah-output-box");
  await expect(
    box.getByRole("button", { name: "Rivitä pitkät rivit" }),
  ).toHaveCount(0);
  await box.evaluate((node) => {
    (node as HTMLElement).style.width = "110px";
  });
  await expect(
    box.getByRole("button", { name: "Rivitä pitkät rivit" }),
  ).toBeVisible();
  await box.getByRole("button", { name: "Rivitä pitkät rivit" }).click();
  await expect(
    box.getByRole("button", { name: "Älä rivitä pitkiä rivejä" }),
  ).toBeVisible();
  await box.evaluate((node) => {
    (node as HTMLElement).style.width = "";
  });
  await expect(
    box.getByRole("button", { name: "Älä rivitä pitkiä rivejä" }),
  ).toHaveCount(0);
  expect(
    (await new AxeBuilder({ page }).include(".ah-file-diff-box").analyze())
      .violations,
  ).toEqual([]);
  for (const theme of ["light", "dark"]) {
    await page
      .locator("html")
      .evaluate((node, value) => node.setAttribute("data-theme", value), theme);
    await tool("write").scrollIntoViewIfNeeded();
    await page.screenshot({
      path: `../issues/syntax-highlighting/lab-file-card-${theme}.png`,
    });
  }
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
