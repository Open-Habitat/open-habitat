import AxeBuilder from "@axe-core/playwright";
import { hostOrigin } from "../test-ports.mjs";
import { expect, test } from "./worker-host";

test.use({
  baseURL: hostOrigin,
  ignoreHTTPSErrors: true,
  viewport: { width: 1280, height: 900 },
});
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aYioAAAAASUVORK5CYII=",
  "base64",
);

test("picker, image paste and conversation drop persist authenticated attachments", async ({
  page,
}) => {
  await page.request.get("/fixture/scenario?value=ready");
  await page.goto("/workspaces");
  await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
  await page.getByRole("link", { name: "Alice", exact: true }).click();
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "ordinary-dir", exact: true })
    .click();
  await page.getByRole("button", { name: "Aloita uusi Pi-keskustelu" }).click();
  await expect(page).toHaveURL(/conversation=pi:/);
  const field = page.getByRole("textbox", { name: "Viesti Pi:lle" });
  const choose = page.waitForEvent("filechooser");
  await page
    .getByRole("button", { name: "Liitä tiedosto", exact: true })
    .click();
  await (await choose).setFiles({
    name: "screen.png",
    mimeType: "image/png",
    buffer: png,
  });
  await expect(field).toHaveValue(/!\[screen.png\]\(\/api\/v1\/attachments\//);
  await field.evaluate((element, base64) => {
    const data = new DataTransfer();
    data.items.add(
      new File(
        [Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))],
        "pasted.png",
        { type: "image/png" },
      ),
    );
    element.dispatchEvent(
      new ClipboardEvent("paste", {
        clipboardData: data,
        bubbles: true,
        cancelable: true,
      }),
    );
  }, png.toString("base64"));
  await expect(field).toHaveValue(/pasted.png/);
  await page.locator(".ah-conversation-stream").evaluate((element) => {
    const data = new DataTransfer();
    data.items.add(
      new File(["synthetic file"], "notes.txt", { type: "text/plain" }),
    );
    element.dispatchEvent(
      new DragEvent("drop", {
        dataTransfer: data,
        bubbles: true,
        cancelable: true,
      }),
    );
  });
  await expect(field).toHaveValue(/notes.txt/);
  const draft = await field.inputValue();
  const url = /\((\/api\/v1\/attachments\/[a-f0-9-]+)\)/.exec(draft)?.[1];
  expect(url).toBeTruthy();
  const image = await page.request.get(url ?? "");
  expect(image.headers()["content-type"]).toBe("image/png");
  expect(await image.body()).toEqual(png);
  const download = page.waitForEvent("download");
  await page.locator('.ah-attachment-chips a[download="notes.txt"]').click();
  expect((await download).suggestedFilename()).toBe("notes.txt");
  expect(
    (
      await page.request.post("/api/v1/attachments", { data: "no csrf" })
    ).status(),
  ).toBe(403);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByRole("button", { name: "Lähetä", exact: true }).click();
  await expect(field).toHaveValue("");
  await expect(
    page.locator(".ah-user-content .ah-attachment-chips img").first(),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.locator(".ah-user-content .ah-attachment-chips img").first(),
  ).toBeVisible();
});
