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
  await page.getByTestId("github-sign-in").click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
  await page
    .getByRole("navigation")
    .getByTestId("workspace-ordinary-dir")
    .click();
  await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
  await expect(page).toHaveURL(/conversation=pi:/);
  const field = page.getByTestId("message-input");
  const choose = page.waitForEvent("filechooser");
  await page.getByTestId("attach-file").click();
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
  await page
    .getByTestId("send")
    .and(page.locator('[data-mode="send"]'))
    .click();
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
  await page
    .getByTestId("send")
    .and(page.locator('[data-mode="send"]'))
    .click();
  const rows = page.locator('.ah-feed > li[data-kind="user"]');
  await expect(rows).toHaveCount(2);
  await expectNativeContent(page, /Selvä\. Kysyit:/, {
    count: 2,
    visible: false,
  });
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
      const expand = rows.last().getByTestId("expand-message");
      await expand.click();
      await expect(rows.last()).toContainText("unbroken_code_".repeat(100));
      await expectAligned();
      await rows.last().getByTestId("expand-message").click();
      await expect(
        page.locator(".ah-user-content .ah-attachment-chips img").first(),
      ).toBeVisible();
    }
  }
});

// Native content is asserted independently of translated controls. This helper
// only reads rendered content; it never finds an element for an interaction.
async function expectNativeContent(
  scope: import("@playwright/test").Page | import("@playwright/test").Locator,
  expected: string | RegExp,
  options: {
    count?: number;
    visible?: boolean;
    exact?: boolean;
    timeout?: number;
  } = {},
) {
  const { count, visible = true, exact = false, timeout } = options;
  const read = () =>
    scope.locator("*").evaluateAll(
      (nodes, args) => {
        const normalize = (text: string) => text.replace(/\s+/g, " ").trim();
        const matches = (node: Element) => {
          if (["SCRIPT", "STYLE", "HEAD"].includes(node.tagName)) return false;
          const text = normalize(node.textContent ?? "");
          return args.regex
            ? new RegExp(args.regex, args.flags).test(text)
            : args.exact
              ? text === normalize(args.text)
              : text.includes(normalize(args.text));
        };
        return nodes.filter(
          (node) =>
            matches(node) &&
            ![...node.children].some(matches) &&
            (!args.visible ||
              (node.getClientRects().length > 0 &&
                getComputedStyle(node).visibility !== "hidden")),
        ).length;
      },
      {
        text: typeof expected === "string" ? expected : "",
        regex: expected instanceof RegExp ? expected.source : "",
        flags: expected instanceof RegExp ? expected.flags : "",
        exact,
        visible,
      },
    );
  if (count === undefined)
    await expect.poll(read, { timeout }).toBeGreaterThan(0);
  else await expect.poll(read, { timeout }).toBe(count);
}
