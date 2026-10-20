import AxeBuilder from "@axe-core/playwright";
import { workerHostPort } from "../test-ports.mjs";
import { createHostTest, expect, type Page } from "./worker-host";

// The workspace editor (Rinnakkain) against the real gateway and daemon
// handlers, with the app and the editor on two same-site host names and a
// stand-in code-server (test/browser-host/editor.go) behind the daemon relay.
// Real code-server and the other engines are exercised separately; see the
// issue's result.
const test = createHostTest(false, { BROWSER_HOST_EDITOR: "1" });
const app = `https://app.oh.localhost:${workerHostPort(Number(process.env.TEST_PARALLEL_INDEX ?? 0))}`;
test.use({
  baseURL: app,
  ignoreHTTPSErrors: true,
  viewport: { width: 1366, height: 768 },
});

const editorFrame = (page: Page) =>
  page
    .frameLocator('iframe[title="VS Code: työtilan editori"]')
    .frameLocator("#editor");

async function conversationWithFileLink(page: Page) {
  await page.goto("/workspaces");
  await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
  await page.getByRole("link", { name: "Alice" }).click();
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "git-project" })
    .click();
  await page.getByRole("button", { name: "Aloita uusi Pi-keskustelu" }).click();
  await page
    .getByRole("textbox", { name: "Viesti Pi:lle" })
    .fill("Missä tiedosto on?");
  await page.getByRole("button", { name: "Lähetä", exact: true }).click();
  await expect(page.getByRole("link", { name: "cmd/main.go:3-4" })).toBeVisible(
    {
      timeout: 20_000,
    },
  );
}

const columnWidth = (page: Page) =>
  page
    .locator("#ah-editor-conversation")
    .evaluate((el) => Math.round(el.getBoundingClientRect().width));

test("@workspace-editor @a11y opens beside the conversation with a remembered divider and a strip", async ({
  page,
}) => {
  await conversationWithFileLink(page);
  const header = page.locator(".ah-agent-header");
  await header.getByRole("button", { name: "Editori" }).click();
  // The editor runs behind the gateway and daemon relays, WebSocket included.
  await expect(
    editorFrame(page).getByRole("heading", { name: "Fake VS Code" }),
  ).toBeVisible();
  await expect(editorFrame(page).getByText("yhteys: pong")).toBeVisible();
  await expect(editorFrame(page).getByText("git-project")).toBeVisible();
  // The app sidebar steps aside; the column defaults to 440 px on a laptop.
  await expect(
    page.getByRole("navigation", { name: "Työtilat ja keskustelut" }),
  ).toBeHidden();
  expect(await columnWidth(page)).toBe(440);
  // The app's own controls around the editor; VS Code's frame is its own.
  expect(
    (await new AxeBuilder({ page }).exclude("iframe").analyze()).violations,
  ).toEqual([]);
  const divider = page.getByRole("separator", { name: "Keskustelun leveys" });
  await divider.focus();
  await page.keyboard.press("ArrowLeft");
  expect(await columnWidth(page)).toBe(472);
  // A drag over the frame still reaches the divider.
  const box = await divider.boundingBox();
  if (!box) throw new Error("divider not laid out");
  const x = box.x + box.width / 2;
  await page.mouse.move(x, box.y + 200);
  await page.mouse.down();
  await page.mouse.move(x - 80, box.y + 200, { steps: 4 });
  await page.mouse.move(x - 100, box.y + 220, { steps: 4 });
  await page.mouse.up();
  expect(await columnWidth(page)).toBe(572);
  // Enter hides the conversation into a strip; the strip brings it back.
  await divider.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#ah-editor-conversation")).toBeHidden();
  const strip = page.getByRole("button", { name: /^Näytä keskustelu/ });
  await expect(strip).toBeVisible();
  await strip.click();
  await expect(
    page.getByRole("textbox", { name: "Viesti Pi:lle" }),
  ).toBeFocused();
  // The width is this browser's preference and survives a reload.
  await page.reload();
  await page
    .locator(".ah-agent-header")
    .getByRole("button", { name: "Editori" })
    .click();
  expect(await columnWidth(page)).toBe(572);
  await page.getByRole("button", { name: "Sulje editori" }).click();
  await expect(
    page.getByRole("navigation", { name: "Työtilat ja keskustelut" }),
  ).toBeVisible();
});

test("@workspace-editor file links open path:line and Ctrl+Alt+K moves between editor and conversation", async ({
  page,
}) => {
  await conversationWithFileLink(page);
  const link = page.getByRole("link", { name: "cmd/main.go:3-4" });
  await link.click();
  await expect(editorFrame(page).getByText("main.go:3-4")).toBeVisible();
  await expect(link).toHaveClass(/ah-file-link-opened/);
  // A name that is not a file in the workspace says so, and opens nothing.
  await page.getByRole("link", { name: "cmd/old.go" }).click();
  await expect(
    page.getByText("Tiedostoa cmd/old.go ei löydy työtilasta."),
  ).toBeVisible();
  await expect(editorFrame(page).getByText("main.go:3-4")).toBeVisible();

  const composer = page.getByRole("textbox", { name: "Viesti Pi:lle" });
  // Inside the editor the frame keeps its keys; the app still hears this one.
  await editorFrame(page).getByRole("textbox", { name: "Editor text" }).click();
  await page.keyboard.press("Control+Alt+KeyK");
  await expect(composer).toBeFocused();
  await page.keyboard.press("Control+Alt+KeyK");
  await expect(
    page.locator('iframe[title="VS Code: työtilan editori"]'),
  ).toBeFocused();
  // A hidden conversation comes back first.
  await page.getByRole("button", { name: "Piilota keskustelu" }).click();
  await editorFrame(page).getByRole("textbox", { name: "Editor text" }).click();
  await page.keyboard.press("Control+Alt+KeyK");
  await expect(composer).toBeFocused();
});

test("@workspace-editor a reply that ends while the conversation is hidden marks the strip", async ({
  page,
}) => {
  await conversationWithFileLink(page);
  await page
    .locator(".ah-agent-header")
    .getByRole("button", { name: "Editori" })
    .click();
  await expect(editorFrame(page).getByText("yhteys: pong")).toBeVisible();
  await page
    .getByRole("textbox", { name: "Viesti Pi:lle" })
    .fill("Toinen tiedosto");
  await page.getByRole("button", { name: "Lähetä", exact: true }).click();
  await page.getByRole("button", { name: "Piilota keskustelu" }).click();
  await expect(
    page.getByRole("button", { name: "Näytä keskustelu (Uusi vastaus)" }),
  ).toBeVisible({ timeout: 20_000 });
});

test("@workspace-editor is not offered on a phone", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/workspaces");
  await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
  await page.getByRole("link", { name: "Alice" }).click();
  await page
    .getByRole("region", { name: "Ei avointa työtä" })
    .getByRole("link", { name: "git-project" })
    .click();
  await page.getByRole("button", { name: "Aloita uusi Pi-keskustelu" }).click();
  await page
    .getByRole("textbox", { name: "Viesti Pi:lle" })
    .fill("Missä tiedosto on?");
  await page.getByRole("button", { name: "Lähetä", exact: true }).click();
  await expect(page.getByText("cmd/main.go:3-4")).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByRole("link", { name: "cmd/main.go:3-4" })).toHaveCount(
    0,
  );
  await expect(page.getByRole("button", { name: "Editori" })).toHaveCount(0);
});
