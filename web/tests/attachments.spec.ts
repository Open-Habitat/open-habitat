import AxeBuilder from "@axe-core/playwright";
import { snapshot } from "../lab/session.mjs";
import { hostOrigin } from "../test-ports.mjs";
import { dropFiles } from "./conversation-view";
import { expect, test } from "./worker-host";

test.use({
  baseURL: hostOrigin,
  ignoreHTTPSErrors: true,
  viewport: { width: 1280, height: 900 },
  deviceScaleFactor: 2,
});
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=",
  "base64",
);

test("thirty attachments totaling 100 MiB send, while an extra file is refused without losing the draft", async ({
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
  const composer = page.locator(".ah-composer");
  const input = composer.locator('input[type="file"]');
  const chips = composer.getByTestId("attachment-chip");
  const files = Array.from({ length: 31 }, (_, i) => ({
    name: `file-${i}.txt`,
    mimeType: "text/plain",
    buffer: Buffer.from(`file ${i}`),
  }));
  await page.getByTestId("message-input").fill("Read these files");
  await input.setInputFiles(files);
  await expect(composer.getByRole("alert")).toBeVisible();
  await expect(chips).toHaveCount(0);
  // Construct bytes in the browser rather than base64-copying 100 MiB
  // through the Playwright transport. Ten 4 MiB + twenty 3 MiB files.
  const pickBatch = (fours: number) =>
    input.evaluate((element: HTMLInputElement, fours) => {
      const data = new DataTransfer();
      for (let i = 0; i < 30; i++) {
        data.items.add(
          new File(
            [new Uint8Array((i < fours ? 4 : 3) * 1024 * 1024)],
            `file-${i}.bin`,
          ),
        );
      }
      element.files = data.files;
      element.dispatchEvent(new Event("change", { bubbles: true }));
    }, fours);
  await pickBatch(10);
  await expect(chips).toHaveCount(30);
  await input.setInputFiles(files.slice(30));
  await expect(composer.getByRole("alert")).toBeVisible();
  await expect(chips).toHaveCount(30);
  await expect(page.getByTestId("message-input")).toHaveValue(
    "Read these files",
  );
  await page
    .getByTestId("send")
    .and(page.locator('[data-mode="send"]'))
    .click();
  await expect(
    page
      .locator('.ah-feed > li[data-kind="user"]')
      .last()
      .getByTestId("attachment-chip"),
  ).toHaveCount(30);
  await expect(chips).toHaveCount(0);

  // A valid file count does not bypass the aggregate byte budget. Refusal
  // preserves all attachments and the draft, rather than silently truncating.
  await pickBatch(11);
  await expect(chips).toHaveCount(30);
  await page.getByTestId("message-input").fill("Too large together");
  await page
    .getByTestId("send")
    .and(page.locator('[data-mode="send"]'))
    .click();
  await expect(page.getByTestId("send-receipt")).toBeVisible();
  await expect(chips).toHaveCount(30);
  await expect(page.getByTestId("message-input")).toHaveValue(
    "Too large together",
  );
  await expect(page.locator('.ah-feed > li[data-kind="user"]')).toHaveCount(1);
});

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
  await expect(page.getByTestId("attachment-panel")).toHaveCount(0);
  await (await choose).setFiles({
    name: "screen.png",
    mimeType: "image/png",
    buffer: png,
  });
  // The field stays as the person typed it; the attachment is a chip.
  const chips = page.locator(".ah-composer").getByTestId("attachment-chip");
  await expect(chips).toHaveCount(1);
  await expect(chips.first()).toHaveAttribute("data-attachment-kind", "image");
  await expect(field).toHaveValue("");
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
  await expect(chips).toHaveCount(2);
  await dropFiles(page, [
    {
      name: "notes.txt",
      bytes: new TextEncoder().encode("synthetic file"),
      type: "text/plain",
    },
  ]);
  await expect(chips).toHaveCount(3);
  await expect(field).toHaveValue("");
  const url = await chips.first().getAttribute("data-attachment-url");
  expect(url).toMatch(/^\/api\/v1\/attachments\/[a-f0-9-]+$/);
  const image = await page.request.get(url ?? "");
  expect(image.headers()["content-type"]).toBe("image/png");
  expect(await image.body()).toEqual(png);

  // A file opens in the app's own dialog with its size; download is secondary.
  const file = chips.and(page.locator('[data-attachment-kind="file"]'));
  await file.getByTestId("attachment-open").click();
  const preview = page.getByTestId("attachment-preview");
  await expect(preview).toBeVisible();
  await expect(preview.getByTestId("attachment-size")).toContainText(
    String("synthetic file".length),
  );
  const download = page.waitForEvent("download");
  await preview.getByTestId("attachment-original").click();
  expect((await download).suggestedFilename()).toBe("notes.txt");
  await page.keyboard.press("Escape");
  await expect(preview).toHaveCount(0);

  // An image opens at a size that fits; a click outside closes it.
  await chips.first().getByTestId("attachment-open").click();
  await expect(preview.locator("img")).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.mouse.click(5, 5);
  await expect(preview).toHaveCount(0);

  // Removing a chip removes its reference; the field is untouched.
  await field.fill("Katso liitteet");
  await chips.nth(1).getByTestId("attachment-remove").click();
  await expect(chips).toHaveCount(2);
  await expect(field).toHaveValue("Katso liitteet");
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
  await expect(chips).toHaveCount(0);
  // The agent received the references: the sent message shows the same two
  // attachments, and its text is what the person wrote.
  const sent = page.locator('.ah-feed > li[data-kind="user"]');
  await expect(sent.getByTestId("attachment-chip")).toHaveCount(2);
  await expect(sent.getByTestId("attachment-chip").first()).toHaveAttribute(
    "data-attachment-url",
    url ?? "",
  );
  await page.reload();
  await expect(sent.locator(".ah-attachment-chips img").first()).toBeVisible();
  await expectNativeContent(
    page.locator(".ah-user-content"),
    "Katso liitteet",
    {
      exact: true,
      count: 1,
    },
  );
  // Neither the reference nor the host's path line shows in the bubble.
  await expectNativeContent(sent, "/api/v1/attachments/", { count: 0 });
  await expectNativeContent(sent, "Attachment path:", { count: 0 });

  // A sent thumbnail opens the same dialog, also at phone width.
  await page.setViewportSize({ width: 390, height: 844 });
  await sent.getByTestId("attachment-open").first().click();
  await expect(preview).toBeVisible();
  const box = await preview.boundingBox();
  expect(box && box.x >= 0 && box.x + box.width <= 390).toBe(true);
  const shown = await preview
    .locator("img")
    .evaluate((img) => img.getBoundingClientRect().width);
  expect(shown).toBeLessThanOrEqual(390);
  await page.keyboard.press("Escape");
  await expect(preview).toHaveCount(0);
  await page.setViewportSize({ width: 1280, height: 900 });

  // Exercise bubble alignment with persisted thumbnails and long literal code,
  // not just short text: intrinsic content must not push a phone-width row out.
  // The long message carries an attachment too: collapsing its text must not
  // hide the attachment below the cut.
  const again = page.waitForEvent("filechooser");
  await page.getByTestId("attach-file").click();
  await (await again).setFiles({
    name: "long.png",
    mimeType: "image/png",
    buffer: png,
  });
  await expect(chips).toHaveCount(1);
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
      await expectUnclipped(rows.last().getByTestId("attachment-open"));
      const expand = rows.last().getByTestId("expand-message");
      await expand.click();
      await expect(rows.last()).toContainText("unbroken_code_".repeat(100));
      await expectAligned();
      await rows.last().getByTestId("expand-message").click();
      await expect(
        sent.locator(".ah-attachment-chips img").first(),
      ).toBeVisible();
    }
  }
});

test("large image chips download only thumbnails, including after sending and reloading", async ({
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
  const originals: string[] = [];
  const thumbnails: number[] = [];
  page.on("request", (request) => {
    if (
      request.method() === "GET" &&
      /\/attachments\/[a-f0-9-]+$/.test(request.url())
    )
      originals.push(request.url());
  });
  page.on("response", async (response) => {
    if (
      /\/attachments\/[a-f0-9-]+\/thumbnail$/.test(response.url()) &&
      response.ok()
    )
      thumbnails.push((await response.body()).length);
  });
  const composer = page.locator(".ah-composer");
  const chips = composer.getByTestId("attachment-chip");
  // 26 MiB exceeds the existing upload cap: refuse before any preview request.
  await composer
    .locator('input[type="file"]')
    .evaluate((element: HTMLInputElement) => {
      const data = new DataTransfer();
      data.items.add(
        new File([new Uint8Array(26 * 1024 * 1024)], "too-large.png", {
          type: "image/png",
        }),
      );
      element.files = data.files;
      element.dispatchEvent(new Event("change", { bubbles: true }));
    });
  await expect(composer.getByRole("alert")).toBeVisible();
  await expect(chips).toHaveCount(0);
  expect(originals).toEqual([]);
  expect(thumbnails).toEqual([]);
  // Keep large encoded files inside the browser, without copying 95 MiB
  // through Playwright. PNG permits trailing bytes; pixels stay synthetic.
  await composer
    .locator('input[type="file"]')
    .evaluate(async (element: HTMLInputElement) => {
      const canvas = document.createElement("canvas");
      canvas.width = 1200;
      canvas.height = 800;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("missing canvas");
      ctx.fillStyle = "#6495ad";
      ctx.fillRect(0, 0, 1200, 800);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(200, 100, 400, 500);
      const png = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (blob) => (blob ? resolve(blob) : reject(new Error("missing PNG"))),
          "image/png",
        ),
      );
      const data = new DataTransfer();
      for (let i = 0; i < 5; i++) {
        data.items.add(
          new File(
            [png, new Uint8Array(19 * 1024 * 1024 - png.size)],
            `large-${i}.png`,
            { type: "image/png" },
          ),
        );
      }
      element.files = data.files;
      element.dispatchEvent(new Event("change", { bubbles: true }));
    });
  await expect(chips).toHaveCount(5);
  const loaded = (scope: import("@playwright/test").Locator) =>
    expect
      .poll(() =>
        scope.locator("img").evaluateAll(
          (images) =>
            images.length === 5 &&
            images.every((node) => {
              const image = node as HTMLImageElement;
              return (
                image.complete &&
                image.naturalWidth > 0 &&
                Math.max(image.naturalWidth, image.naturalHeight) <= 320
              );
            }),
        ),
      )
      .toBe(true);
  await loaded(chips);
  expect(originals).toEqual([]);
  await expect.poll(() => thumbnails.length).toBe(5);
  expect(thumbnails.every((size) => size > 0 && size < 100 * 1024)).toBe(true);
  if (process.env.OH_VISUAL_CAPTURE === "1") {
    await snapshot(
      page,
      "../issues/attachment-chip-thumbnails/evidence/draft-chips",
    );
  }
  await page
    .getByTestId("send")
    .and(page.locator('[data-mode="send"]'))
    .click();
  const sent = page
    .locator('.ah-feed > li[data-kind="user"]')
    .getByTestId("attachment-chip");
  await loaded(sent);
  await page.reload();
  await loaded(sent);
  expect(originals).toEqual([]);
  // A server refusal shows an icon, never an automatic full-image retry.
  const firstURL = await sent.first().getAttribute("data-attachment-url");
  await page.route(`**${firstURL}/thumbnail`, (route) =>
    route.fulfill({ status: 404 }),
  );
  await page.reload();
  await expect(sent).toHaveCount(5);
  await expect(sent.first().locator("img")).toHaveCount(0);
  await expect(sent.first().locator("svg")).toBeVisible();
  expect(originals).toEqual([]);
  // Only explicitly opening the image may fetch the original.
  await sent.first().getByTestId("attachment-open").click();
  await expect(
    page.getByTestId("attachment-preview").locator("img"),
  ).toBeVisible();
  await expect.poll(() => originals.length).toBe(1);
});

test("a dropped or picked attachment leaves the person writing on from the end of the draft", async ({
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
  const chips = page.locator(".ah-composer").getByTestId("attachment-chip");
  await field.fill("Katso");
  await field.evaluate((element: HTMLTextAreaElement) => {
    element.setSelectionRange(0, 0);
    element.blur();
  });
  await dropFiles(page, [
    {
      name: "notes.txt",
      bytes: new TextEncoder().encode("synthetic file"),
      type: "text/plain",
    },
  ]);
  await expect(chips).toHaveCount(1);
  await expect(field).toBeFocused();
  await page.keyboard.type(" tätä");
  await expect(field).toHaveValue("Katso tätä");

  // The picker: the paperclip and the file dialog take the
  // focus on the way, and the field has it again once the chip shows.
  await field.evaluate((element: HTMLTextAreaElement) =>
    element.setSelectionRange(0, 0),
  );
  const choose = page.waitForEvent("filechooser");
  await page.getByTestId("attach-file").click();
  await (await choose).setFiles({
    name: "screen.png",
    mimeType: "image/png",
    buffer: png,
  });
  await expect(chips).toHaveCount(2);
  await expect(field).toBeFocused();
  await page.keyboard.type(" ja tätä");
  await expect(field).toHaveValue("Katso tätä ja tätä");
});

// An element the person can see and press: the point at its centre hits it,
// rather than whatever lies under a clipping ancestor. Visibility checks alone
// pass for an element cut off by `overflow: hidden`.
async function expectUnclipped(target: import("@playwright/test").Locator) {
  await expect
    .poll(() =>
      target.evaluate((node) => {
        // Scroll its feed row, not the element: scrolling the element would
        // also scroll a clipping ancestor and reveal it. Centred, so the
        // fixed composer cannot be what covers it.
        (node.closest(".ah-feed > li") ?? node).scrollIntoView({
          block: "center",
        });
        const box = node.getBoundingClientRect();
        const hit = document.elementFromPoint(
          box.left + box.width / 2,
          box.top + box.height / 2,
        );
        return !!hit && node.contains(hit);
      }),
    )
    .toBe(true);
}

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
