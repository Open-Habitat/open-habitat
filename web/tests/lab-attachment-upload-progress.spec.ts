import { readFile, writeFile } from "node:fs/promises";
import { snapshot } from "../lab/session.mjs";
import { labOrigin } from "../test-ports.mjs";
import { expect, test } from "./lab-host";

type UploadWindow = typeof window & {
  uploadTest: {
    progress: (loaded: number) => void;
    release: () => void;
    count: () => number;
  };
};
test.use({ baseURL: labOrigin, ignoreHTTPSErrors: true });
for (const width of [1440, 390]) {
  for (const language of ["fi", "en-US"]) {
    test(`upload progress, cancellation and explicit send at ${width} ${language}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      // Hold File sends, not replies: deterministic slow first-hop progress,
      // followed by the real XHR and real host attachment handler.
      await page.addInitScript(() => {
        const send = XMLHttpRequest.prototype.send;
        const held: { xhr: XMLHttpRequest; body: File }[] = [];
        Object.assign(window, {
          uploadTest: {
            progress(loaded: number) {
              held
                .at(-1)
                ?.xhr.upload.dispatchEvent(
                  new ProgressEvent("progress", { loaded }),
                );
            },
            release() {
              const item = held.at(-1);
              if (item) send.call(item.xhr, item.body);
            },
            count() {
              return held.length;
            },
          },
        });
        XMLHttpRequest.prototype.send = function (body) {
          if (body instanceof File) held.push({ xhr: this, body });
          else send.call(this, body);
        };
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
      ]) {
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
      }
      await page.reload();
      const state = await (await page.request.get("/api/v1/snapshot")).json();
      const workspace = state.workspaces.find(
        (w: { name: string }) => w.name === "aurinkokello",
      );
      await page.goto(`/workspaces/${workspace.workspace_id}`);
      await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
      await expect(page).toHaveURL(/conversation=pi:/);
      await page.setViewportSize({ width, height: 900 });
      const composer = page.locator(".ah-composer");
      const input = composer.locator('input[type="file"]');
      const sendButton = composer.getByTestId("send");
      await page.getByTestId("message-input").fill("Read this attachment");
      await input.setInputFiles([
        {
          name: "cancel.txt",
          mimeType: "text/plain",
          buffer: Buffer.alloc(100, 65),
        },
        {
          name: "keep.txt",
          mimeType: "text/plain",
          buffer: Buffer.alloc(100, 66),
        },
      ]);
      await expect(composer.getByTestId("attachment-progress")).toHaveCount(2);
      await page.evaluate(() =>
        (window as UploadWindow).uploadTest.progress(42),
      );
      await expect(
        composer.getByTestId("attachment-progress").first(),
      ).toHaveText("42 %");
      await expect(sendButton).toBeDisabled();
      const capture = async (name: string) => {
        if (process.env.OH_VISUAL_CAPTURE !== "1") return;
        const base = `../issues/attachment-upload-progress/evidence/${name}-${width}-${language}`;
        await snapshot(page, base, { labOrigin: new URL(page.url()).origin });
        await writeFile(
          `${base}.html`,
          (await readFile(`${base}.html`, "utf8")).replace(/[ \\t]+$/gm, ""),
        );
      };
      await capture("upload");
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.getByTestId("account-menu-trigger").click();
      await page.getByTestId("menu-explain").click();
      await page.setViewportSize({ width, height: 900 });
      await composer.getByTestId("attachment-progress").first().hover();
      await expect(page.getByTestId("explain-card")).toHaveAttribute(
        "data-card",
        "V36",
      );
      await capture("explain-progress");
      await composer.getByTestId("attachment-progress-ring").first().hover();
      await expect(page.getByTestId("explain-card")).toHaveAttribute(
        "data-card",
        "V36",
      );
      await composer.getByTestId("attachment-cancel").first().hover();
      await expect(page.getByTestId("explain-card")).toHaveAttribute(
        "data-card",
        "V37",
      );
      await capture("explain-cancel");
      await composer.getByTestId("attachment-cancel").first().click();
      await expect(composer.getByTestId("attachment-chip")).toHaveCount(2);
      await page.getByTestId("explain-stop").click();
      await page.getByTestId("message-input").press("Enter");
      await expect(page.getByTestId("message-input")).toHaveValue(
        "Read this attachment",
      );
      // Adding files remains available, and cancelling a queued file leaves
      // the active upload alone.
      await input.setInputFiles({
        name: "queued.txt",
        mimeType: "text/plain",
        buffer: Buffer.from("queued"),
      });
      await composer.getByTestId("attachment-cancel").last().click();
      await expect(
        composer.getByTestId("attachment-progress").first(),
      ).toHaveText("42 %");
      await composer.getByTestId("attachment-cancel").first().click();
      await expect
        .poll(() =>
          page.evaluate(() => (window as UploadWindow).uploadTest.count()),
        )
        .toBe(2);
      await expect(composer.getByTestId("attachment-chip")).toHaveCount(1);
      await expect(composer.getByTestId("attachment-chip")).toContainText(
        "keep.txt",
      );
      await page.evaluate(() =>
        (window as UploadWindow).uploadTest.progress(100),
      );
      await expect(composer.getByTestId("attachment-progress")).toHaveText(
        language === "fi" ? "Tallennetaan" : "Saving",
      );
      await expect(sendButton).toBeDisabled();
      await page.emulateMedia({ reducedMotion: "reduce" });
      expect(
        await composer
          .getByTestId("attachment-progress-ring")
          .evaluate((element) => getComputedStyle(element).animationName),
      ).toBe("none");
      await page.emulateMedia({ reducedMotion: "no-preference" });
      await page.evaluate(() => (window as UploadWindow).uploadTest.release());
      await expect(composer.getByTestId("attachment-progress")).toHaveCount(0);
      await expect(sendButton).toBeEnabled();
      await expect(page.getByTestId("message-input")).toHaveValue(
        "Read this attachment",
      );
      await expect(page.locator('.ah-feed > li[data-kind="user"]')).toHaveCount(
        0,
      );
      await page.route(
        "**/api/v1/attachments",
        (route) => route.abort("failed"),
        { times: 1 },
      );
      await input.setInputFiles([
        {
          name: "retry.txt",
          mimeType: "text/plain",
          buffer: Buffer.from("retry"),
        },
        {
          name: "waiting.txt",
          mimeType: "text/plain",
          buffer: Buffer.from("waiting"),
        },
      ]);
      await page.evaluate(() => (window as UploadWindow).uploadTest.release());
      const warning = page
        .getByTestId("notice-stack")
        .getByTestId("attachment-refusal");
      await expect(warning).toContainText("retry.txt");
      await expect(warning.getByTestId("attachment-refusal-retry")).toHaveCount(
        1,
      );
      await expect(composer.getByTestId("attachment-chip")).toHaveCount(3);
      expect(
        await page.evaluate(() => (window as UploadWindow).uploadTest.count()),
      ).toBe(3);
      await capture("failure");
      await warning.getByTestId("attachment-refusal-retry").click();
      await expect
        .poll(() =>
          page.evaluate(() => (window as UploadWindow).uploadTest.count()),
        )
        .toBe(4);
      await page.evaluate(() => (window as UploadWindow).uploadTest.release());
      await expect
        .poll(() =>
          page.evaluate(() => (window as UploadWindow).uploadTest.count()),
        )
        .toBe(5);
      await page.evaluate(() => (window as UploadWindow).uploadTest.release());
      await expect(sendButton).toBeEnabled();
      await expect(page.getByTestId("message-input")).toHaveValue(
        "Read this attachment",
      );
      await sendButton.click();
      await expect(
        page.locator('.ah-feed > li[data-kind="user"]').last(),
      ).toContainText("Read this attachment");
    });
  }
}
