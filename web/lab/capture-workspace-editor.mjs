// Captures the workspace editor (Rinnakkain) for implement-workspace-editor.
// Needs the synthetic host in lab and editor mode, for example with a pinned
// code-server unpacked in a disposable directory:
//   BROWSER_HOST_LAB=1 BROWSER_HOST_EDITOR=1 BROWSER_HOST_PORT=<port> \
//   BROWSER_HOST_CODE_SERVER=<dir>/bin/code-server .cache/browser-host web/dist
// then: node web/lab/capture-workspace-editor.mjs <port>
// Writes only into issues/implement-workspace-editor/evidence/.
import { chromium } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { snapshot } from "./session.mjs";

const port = process.argv[2];
if (!/^[0-9]{4,5}$/.test(port ?? "")) throw new Error("usage: <port>");
const app = `https://app.oh.localhost:${port}`;
const out = fileURLToPath(
  new URL("../../issues/implement-workspace-editor/evidence/", import.meta.url),
);

const browser = await chromium.launch({ headless: true });
async function session(width, height, scheme) {
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    viewport: { width, height },
    colorScheme: scheme,
  });
  const page = await context.newPage();
  await page.goto(`${app}/workspaces`);
  await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
  await page.getByRole("link", { name: "Alice", exact: true }).click();
  await page.waitForURL(/\/workspaces/);
  const id = await page.evaluate(
    async () =>
      (await (await fetch("/api/v1/snapshot")).json()).workspaces.find(
        (w) => w.name === "aurinkokello",
      ).workspace_id,
  );
  await page.goto(`${app}/workspaces/${id}`);
  await page.getByRole("button", { name: "Aloita uusi Pi-keskustelu" }).click();
  await page
    .getByRole("textbox", { name: "Viesti Pi:lle" })
    .fill("Missä tiedosto on?");
  await page.getByRole("button", { name: "Lähetä", exact: true }).click();
  return { context, page };
}
const shot = (page, name) =>
  snapshot(page, `${out}${name}`, { labOrigin: app });
const workbench = (page) =>
  page
    .frameLocator('iframe[title="VS Code: työtilan editori"]')
    .frameLocator("#editor")
    .locator(".monaco-workbench, .fake-workbench")
    .first();

{
  const { context, page } = await session(1366, 768, "light");
  const link = page.getByRole("link", { name: "cmd/main.go:3-4" });
  await link.waitFor({ timeout: 30_000 });
  await shot(page, "l1366-1-keskustelu");
  await link.click();
  await workbench(page).waitFor({ timeout: 60_000 });
  await page.waitForTimeout(6000); // the extension activates, then the file opens
  await shot(page, "l1366-2-linkki");
  await page.getByRole("button", { name: "Piilota keskustelu" }).click();
  await page.waitForTimeout(500);
  await shot(page, "l1366-3-piilotettu");
  await context.close();
}
{
  const { context, page } = await session(1920, 1080, "dark");
  await page.getByRole("link", { name: "cmd/main.go:3-4" }).click();
  await workbench(page).waitFor({ timeout: 60_000 });
  await page.waitForTimeout(6000);
  await shot(page, "d1920-linkki");
  await context.close();
}
{
  const { context, page } = await session(390, 844, "light");
  await page.getByText("cmd/main.go:3-4").waitFor({ timeout: 30_000 });
  await shot(page, "puhelin-ei-editoria");
  await context.close();
}
await browser.close();
