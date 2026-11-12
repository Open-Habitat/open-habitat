import { readFile, writeFile } from "node:fs/promises";
import AxeBuilder from "@axe-core/playwright";
import { snapshot } from "../lab/session.mjs";
import { labOrigin } from "../test-ports.mjs";
import { expect, test } from "./lab-host";

test.use({ baseURL: labOrigin, ignoreHTTPSErrors: true });
for (const width of [1440, 390]) {
  for (const language of ["fi", "en-US"]) {
    test(`conversation notices stay above the field, two visible, at ${width} ${language}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.route("**/api/v1/account/storage", async (route) => {
        await route.fulfill({
          json: {
            schema_version: 1,
            limits: "not_in_use",
            filesystem: { capacity_bytes: 50 * 1024 ** 3, free_bytes: 0 },
          },
        });
      });
      await page.request.get("/fixture/scenario?value=ready");
      await page.goto("/workspaces");
      await page.getByTestId("github-sign-in").click();
      await page
        .getByRole("link")
        .and(page.locator('a[href*="code=42"]'))
        .click();
      const session = await (await page.request.get("/auth/session")).json();
      for (const data of [
        { language },
        { experimental: { "explain-mode": true } },
      ])
        expect(
          (
            await page.request.put("/api/v1/account/preferences", {
              headers: {
                Origin: new URL(page.url()).origin,
                "X-Agent-Host-CSRF": session.csrf,
              },
              data,
            })
          ).ok(),
        ).toBe(true);
      await page.reload();
      const state = await (await page.request.get("/api/v1/snapshot")).json();
      const workspace = state.workspaces.find(
        (w: { name: string }) => w.name === "aurinkokello",
      );
      await page.goto(`/workspaces/${workspace.workspace_id}`);
      await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
      await expect(page).toHaveURL(/conversation=pi:/);
      await page.getByTestId("message-input").fill("Synthetic notice fixture");
      await page
        .getByTestId("send")
        .and(page.locator('[data-mode="send"]'))
        .click();
      await expect(
        page.locator('.ah-feed > li[data-kind="assistant"]'),
      ).toHaveCount(1);
      await page.route("**/api/v1/agents/*/history*", (route) =>
        route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({
            schema_version: 1,
            error: {
              code: "native_source_unavailable",
              message: "unavailable",
              retryable: false,
              correlation_id: "req_00000000",
            },
          }),
        }),
      );
      await page.reload();
      await page.setViewportSize({ width, height: 1000 });
      // The history card waits for the quiet re-read before it shows.
      await expect(page.getByTestId("history-unavailable")).toBeVisible({
        timeout: 15_000,
      });
      await expect(page.getByTestId("storage-full-notice")).toBeVisible();
      await page
        .locator('.ah-composer input[type="file"]')
        .evaluate((element: HTMLInputElement) => {
          const files = new DataTransfer();
          files.items.add(
            new File([new Uint8Array(34 * 1024 * 1024)], "synthetic-video.mov"),
          );
          element.files = files.files;
          element.dispatchEvent(new Event("change", { bubbles: true }));
        });
      const stack = page.getByTestId("notice-stack");
      await expect(stack.locator(".ah-warning:visible")).toHaveCount(2);
      await expect(stack.getByTestId("attachment-refusal")).toBeVisible();
      await expect(page.getByTestId("history-unavailable")).toBeHidden();
      await expect(page.getByTestId("history-read-error")).toHaveCount(0);
      const toggle = stack.getByTestId("notice-stack-toggle");
      await toggle.click();
      await expect(stack.locator(".ah-warning:visible")).toHaveCount(3);
      await expect(page.getByTestId("history-unavailable")).toBeVisible();
      await expect(page.getByTestId("history-unavailable")).toHaveAttribute(
        "data-tone",
        "neutral",
      );
      const field = await page.getByTestId("message-input").boundingBox();
      const bounds = await stack.boundingBox();
      expect(
        bounds && field && bounds.y + bounds.height <= field.y,
      ).toBeTruthy();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBeTruthy();
      expect(
        (
          await new AxeBuilder({ page })
            .include('[data-testid="notice-stack"]')
            .analyze()
        ).violations,
      ).toEqual([]);
      await page.clock.install();
      await page.clock.fastForward(7000);
      await expect(page.getByTestId("attachment-refusal")).toBeVisible();
      const base = `../issues/notices-composer-stack/evidence/stack-${width}-${language}`;
      const capture = async (name: string) => {
        if (process.env.OH_VISUAL_CAPTURE !== "1") return;
        await snapshot(page, name, { labOrigin: new URL(page.url()).origin });
        // CSSOM serialization adds trailing spaces; keep generated evidence clean.
        const path = `${name}.html`;
        await writeFile(
          path,
          (await readFile(path, "utf8")).replace(/[ \t]+$/gm, ""),
        );
      };
      await capture(base);
      const explain = async () => {
        await page.setViewportSize({ width: 1440, height: 1000 });
        await page.getByTestId("account-menu-trigger").click();
        await page.getByTestId("menu-explain").click();
        await page.getByTestId("workspace-create").hover();
        await expect(page.getByTestId("explain-state-card")).toHaveCount(0);
        await page.setViewportSize({ width, height: 1000 });
      };
      await explain();
      await toggle.hover();
      await expect(page.getByTestId("explain-card")).toHaveAttribute(
        "data-card",
        "V33",
      );
      await capture(`${base}-explain-more`);
      await toggle.click();
      await expect(stack.locator(".ah-warning:visible")).toHaveCount(2);
      await toggle.click();
      await expect(stack.locator(".ah-warning:visible")).toHaveCount(3);
      await page.mouse.move(1, 100);
      await stack
        .getByTestId("attachment-refusal")
        .hover({ position: { x: 50, y: 30 } });
      await expect(page.getByTestId("explain-card")).toHaveAttribute(
        "data-card",
        "V35",
      );
      await capture(`${base}-explain-notice`);
      await page.getByTestId("explain-stop").click();
      await page.getByTestId("attachment-refusal-dismiss").click();
      await expect(page.getByTestId("attachment-refusal")).toHaveCount(0);
      await expect(page.getByTestId("message-input")).toBeFocused();
      await expect(toggle).toHaveCount(0);
      await expect(stack.locator(".ah-warning:visible")).toHaveCount(2);
      let uploads = 0;
      await page.route("**/api/v1/attachments", (route) => {
        uploads++;
        return route.abort("failed");
      });
      await page.locator('.ah-composer input[type="file"]').setInputFiles({
        name: "retry.txt",
        mimeType: "text/plain",
        buffer: Buffer.from("synthetic"),
      });
      const retry = page.getByTestId("attachment-refusal-retry");
      await expect(retry).toBeVisible();
      await explain();
      await retry.hover();
      await expect(page.getByTestId("explain-card")).toHaveAttribute(
        "data-card",
        "V34",
      );
      await retry.click();
      expect(uploads).toBe(1);
      await capture(`${base}-explain-retry`);
    });
  }
}
