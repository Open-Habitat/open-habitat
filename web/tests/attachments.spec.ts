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

  // Exercise bubble alignment with persisted thumbnails and long literal code,
  // not just short text: intrinsic content must not push a phone-width row out.
  await field.fill(
    `${"Pitkä viesti rivinvaihtoineen.\n".repeat(20)}\n\`\`\`\n${"unbroken_code_".repeat(100)}\n\`\`\``,
  );
  await page.getByRole("button", { name: "Lähetä", exact: true }).click();
  const rows = page.locator('.ah-feed > li[data-kind="user"]');
  await expect(rows).toHaveCount(2);
  await expect(page.getByText(/Selvä\. Kysyit:/)).toHaveCount(2);
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 });
    for (const theme of ["light", "dark"]) {
      await page.evaluate((value) => {
        document.documentElement.dataset.theme = value;
      }, theme);
      const expectAligned = async () => {
        for (const row of await rows.all()) {
          const bounds = await row.evaluate((node) => {
            const row = node.getBoundingClientRect();
            const message = node.querySelector(".ah-message");
            if (!message) throw new Error("missing message bubble");
            const bubble = message.getBoundingClientRect();
            return {
              rightGap: Math.abs(row.right - bubble.right),
              leftGap: bubble.left - row.left,
              overflow: message.scrollWidth - message.clientWidth,
            };
          });
          expect(bounds.rightGap).toBeLessThanOrEqual(1);
          expect(bounds.leftGap).toBeGreaterThanOrEqual(0);
          expect(bounds.overflow).toBeLessThanOrEqual(1);
        }
        const reply = page
          .locator('.ah-feed > li[data-kind="assistant"]')
          .last();
        const startsOnLeft = await reply.evaluate((node) => {
          const message = node.querySelector(".ah-message");
          if (!message) throw new Error("missing assistant message");
          const row = node.getBoundingClientRect();
          return (
            message.getBoundingClientRect().left < row.left + row.width / 2
          );
        });
        // Agent turns keep their existing inset, rather than moving right.
        expect(startsOnLeft).toBe(true);
      };
      await expectAligned();
      const expand = rows
        .last()
        .getByRole("button", { name: "Näytä koko viesti" });
      await expand.click();
      await expect(rows.last()).toContainText("unbroken_code_".repeat(100));
      await expectAligned();
      await rows.last().getByRole("button", { name: "Supista viesti" }).click();
      await expect(
        page.locator(".ah-user-content .ah-attachment-chips img").first(),
      ).toBeVisible();
    }
  }
});
