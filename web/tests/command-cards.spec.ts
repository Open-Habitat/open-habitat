import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { hostOrigin } from "../test-ports.mjs";
import { expect, test } from "./worker-host";

test.use({ baseURL: hostOrigin, ignoreHTTPSErrors: true });

async function newConversation(page: Page) {
  await page.request.get("/fixture/scenario?value=ready");
  await page.goto("/workspaces");
  await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
  await page.getByRole("link", { name: "Alice", exact: true }).click();
  const snapshot = await (await page.request.get("/api/v1/snapshot")).json();
  const workspace = snapshot.workspaces.find(
    (w: { name: string }) => w.name === "ordinary-dir",
  );
  await page.goto(`/workspaces/${workspace.workspace_id}`);
  await page
    .getByRole("button", { name: "Aloita uusi agenttikeskustelu", exact: true })
    .click();
  await expect(page).toHaveURL(/conversation=pi:/);
  return page.getByRole("textbox", { name: "Viesti agentille" });
}

test("@command-cards: !make serve runs through Pi, shows its run chip, and Esc stops it", async ({
  page,
}) => {
  test.setTimeout(90000);
  const field = await newConversation(page);
  await field.fill("Aloita");
  await field.press("Enter");
  await expect(
    page.getByRole("button", { name: "Lähetä", exact: true }),
  ).toBeVisible({ timeout: 20000 });
  await expect(
    page.getByRole("button", { name: "Pysäytä agentti" }),
  ).toHaveCount(0, { timeout: 20000 });
  await field.fill("!make serve");
  await expect(page.getByText("Komento työtilassa")).toBeVisible();
  await expect(page.getByText("Agentti näkee tulosteen")).toBeVisible();
  await expect(page.getByRole("button", { name: "Aja" })).toBeVisible();
  await field.press("Enter");
  // The field clears, as in Pi's TUI; the command's block streams its output.
  await expect(field).toHaveValue("");
  const run = page.getByRole("region", { name: "Sinä · komento" });
  await expect(run).toContainText("make serve");
  await expect(run).toContainText("Serving HTTP", { timeout: 15000 });
  await expect(run).toContainText("ajossa");
  const stop = page.getByRole("button", { name: "Pysäytä komento make serve" });
  await expect(stop).toBeVisible();
  await expect(page.locator(".ah-crow-run")).toContainText("make serve");
  // A second command while one runs is refused, not queued.
  await field.fill("!ls");
  await field.press("Enter");
  await expect(
    page.getByText("Edellinen komento on vielä käynnissä. Pysäytä se ensin."),
  ).toBeVisible();
  await expect(field).toHaveValue("!ls");
  let releaseAbort!: () => void;
  const abortGate = new Promise<void>((resolve) => {
    releaseAbort = resolve;
  });
  await page.route("**/abort_bash", async (route) => {
    await abortGate;
    await route.continue();
  });
  await field.press("Escape");
  await expect(
    page.getByRole("status").filter({ hasText: "Keskeytetään…" }),
  ).toBeVisible();
  await expect(stop).toBeDisabled();
  await field.press("Escape");
  await expect(run).toContainText("Keskeytetään…");
  releaseAbort();
  await expect(stop).toHaveCount(0, { timeout: 15000 });
  // Pi's own history entry takes over from the live block.
  const saved = page.getByRole("region", {
    name: "Sinä · paikallinen komento",
  });
  await expect(saved).toContainText("pysäytetty", { timeout: 15000 });
  await expect(saved).toContainText("make serve");
  await expect(saved.locator("details")).toHaveAttribute("open", "");
  const summary = saved.locator("summary");
  await summary.focus();
  await page.keyboard.press("Enter");
  await expect(saved.locator("details")).not.toHaveAttribute("open", "");
  await page.keyboard.press("Enter");
  await expect(saved.locator(".ah-cmd-body pre").first()).toBeVisible();
  expect(
    (
      await new AxeBuilder({ page })
        .include(".ah-cmd-run")
        .include(".ah-composer")
        .analyze()
    ).violations,
  ).toEqual([]);
});

test("@command-cards: `!!` keeps the output from Pi and finishes with its exit code", async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  const field = await newConversation(page);
  await field.fill("!!git status");
  await expect(page.getByText("vain sinulle, ei agentille")).toBeVisible();
  // A new conversation's command waits for the Pi it starts.
  await field.press("Enter");
  const saved = page.getByRole("region", {
    name: "Sinä · paikallinen komento",
  });
  await expect(saved).toContainText("!!", { timeout: 25000 });
  await expect(saved).not.toContainText("ei mallin kontekstissa");
  await expect(saved).toContainText("paluuarvo 0");
  await expect(saved.locator("details")).toHaveAttribute("open", "");
  await expect(saved.locator(".ah-cmd-body pre").first()).toBeVisible();
  await expect(page.getByText("vain sinulle, ei agentille")).toHaveCount(0);
  expect(
    await saved.evaluate((el) => {
      const rect = el.getBoundingClientRect();
      return rect.left >= 0 && rect.right <= window.innerWidth;
    }),
  ).toBe(true);
  await page.reload();
  await expect(saved).toContainText("paluuarvo 0");
  await expect(saved.locator(".ah-cmd-body pre").first()).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
