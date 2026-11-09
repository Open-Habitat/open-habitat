import type { Page } from "@playwright/test";
import { labOrigin } from "../test-ports.mjs";
import { expect, test } from "./lab-host";

test.use({ baseURL: labOrigin, ignoreHTTPSErrors: true, deviceScaleFactor: 2 });

async function signIn(page: Page) {
  await page.goto(`${labOrigin}/workspaces`);
  await page.getByTestId("github-sign-in").click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
}
async function create(page: Page, whileCreating?: () => Promise<void>) {
  const snapshot = await (await page.request.get("/api/v1/snapshot")).json();
  const workspace = snapshot.workspaces.find(
    (w: { name: string }) => w.name === "aurinkokello",
  );
  await page.goto(`${labOrigin}/workspaces/${workspace.workspace_id}`);
  let release = () => {};
  if (whileCreating) {
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route("**/api/v1/conversations", async (route) => {
      if (route.request().method() === "POST") await held;
      await route.continue();
    });
  }
  await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
  try {
    await whileCreating?.();
  } finally {
    release();
  }
  await expect(page).toHaveURL(/conversation=pi(?:%3A|:)/);
  await expect(page.getByTestId("message-input")).toBeEnabled();
}
async function send(page: Page, text: string) {
  await page.getByTestId("message-input").fill(text);
  await page.getByTestId("send").click();
}

for (const width of [1440, 1024, 800, 390]) {
  test(`composer stack gaps and edges at ${width}`, async ({
    page,
    browser,
  }) => {
    test.setTimeout(180000);
    await page.setViewportSize({ width, height: 1000 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.request.get("/fixture/conversations-reset");
    await page.request.get("/fixture/scenario?value=ready");
    await signIn(page);
    const context = await browser.newContext({ ignoreHTTPSErrors: true });
    const writer = await context.newPage();
    try {
      await signIn(writer);
      await create(writer);
      // A title longer than the column: the waiting strip must truncate it.
      await send(
        writer,
        "A reply on the other machine that names a long piece of work, so the waiting strip has more title than room at every width",
      );
      await expect(
        page.getByTestId("rail-yours").getByTestId("agent-link"),
      ).toHaveCount(1, { timeout: 25000 });
      const measure = async (name: string) => {
        const selectors = [
          ".ah-turn-working",
          ".ah-next-open",
          ".ah-conversation-notices > *",
          ".ah-bg-badges",
          '[data-testid="composer-queue"]',
          ".ah-composer > .ah-attachment-chips",
          ".ah-cbox",
        ];
        const gaps = () =>
          page.evaluate((selectors) => {
            const boxes = selectors.flatMap((selector) => {
              const elements = Array.from(document.querySelectorAll(selector));
              return elements
                .filter((e) => e.getClientRects().length > 0)
                .map((e) => ({ selector, box: e.getBoundingClientRect() }));
            });
            return boxes.slice(1).map((part, i) => ({
              pair: `${boxes[i].selector} → ${part.selector}`,
              gap: part.box.top - boxes[i].box.bottom,
            }));
          }, selectors);
        // Every visible part shares the field's edges, inside the viewport.
        const edges = () =>
          page.evaluate((selectors) => {
            const field = document.querySelector(".ah-cbox");
            if (!field) throw new Error("missing composer field");
            const { left, right } = field.getBoundingClientRect();
            return selectors.slice(1).flatMap((selector) =>
              Array.from(document.querySelectorAll(selector))
                .filter((e) => e.getClientRects().length > 0)
                .map((e) => e.getBoundingClientRect())
                .filter(
                  (box) =>
                    Math.abs(box.left - left) > 0.5 ||
                    Math.abs(box.right - right) > 0.5 ||
                    box.left < 0 ||
                    box.right > window.innerWidth,
                )
                .map((box) => ({
                  selector,
                  left: box.left,
                  right: box.right,
                  field: [left, right],
                  viewport: window.innerWidth,
                })),
            );
          }, selectors);
        for (const theme of ["light", "dark"]) {
          await page.evaluate((value) => {
            document.documentElement.dataset.theme = value;
          }, theme);
          const capture = process.env.OH_STACK_CAPTURE;
          if (capture && ["waiting", "queued"].includes(name)) {
            const { snapshot } = await import("../lab/session.mjs");
            await snapshot(
              page,
              `${process.env.OH_STACK_CAPTURE_DIR}/${capture}-${width}-${name}-${theme}`,
              { html: false, labOrigin },
            );
          }
          if (capture !== "before")
            expect(await edges(), `${name} ${theme}`).toEqual([]);
        }
        if (process.env.OH_STACK_CAPTURE !== "before") {
          const token = await page
            .locator(".ah-composer")
            .evaluate((e) =>
              Number.parseFloat(
                getComputedStyle(e).getPropertyValue("--ah-s3"),
              ),
            );
          // The transcript follows the resized footer on the next layout frame.
          await expect
            .poll(
              async () =>
                (await gaps()).filter(({ gap }) => Math.abs(gap - token) > 0.5),
              { message: name },
            )
            .toEqual([]);
        }
      };
      await create(page, async () => {
        await expect(page.getByTestId("message-input")).toBeEnabled();
        const chooser = page.waitForEvent("filechooser");
        await page.getByTestId("attach-file").click();
        await (await chooser).setFiles({
          name: "draft.txt",
          mimeType: "text/plain",
          buffer: Buffer.from("Synthetic draft"),
        });
        await expect(
          page.locator(".ah-composer > .ah-attachment-chips"),
        ).toBeVisible();
        await expect(page.locator(".ah-bg-badges")).toHaveCount(0);
        await measure("without-chips");
        await page.getByTestId("attachment-remove").click();
      });
      await measure("idle");
      await page.request.get("/fixture/scenario?value=pi-visual-hold");
      await send(page, "Hold the turn");
      await expect(page.getByTestId("next-waiting")).toBeVisible();
      await measure("waiting");
      await send(page, "A queued steer");
      await expect(page.getByTestId("composer-queue")).toBeVisible();
      await measure("queued");
      const chooser = page.waitForEvent("filechooser");
      await page.getByTestId("attach-file").click();
      await (await chooser).setFiles({
        name: "notes.txt",
        mimeType: "text/plain",
        buffer: Buffer.from("Synthetic attachment"),
      });
      await expect(
        page.locator(".ah-composer > .ah-attachment-chips"),
      ).toBeVisible();
      await expect(page.getByTestId("next-waiting")).toHaveCount(0);
      await measure("attachment");
      await page.getByTestId("attachment-remove").click();
      await page.getByTestId("composer-restore-queue").click();
      await expect(page.getByTestId("composer-queue")).toHaveCount(0);
      await measure("draft");
    } finally {
      await context.close();
    }
  });
}
