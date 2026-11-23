import { readFile, writeFile } from "node:fs/promises";
import AxeBuilder from "@axe-core/playwright";
import { snapshot } from "../lab/session.mjs";
import { labOrigin } from "../test-ports.mjs";
import { expect, test } from "./lab-host";

test.use({
  baseURL: labOrigin,
  ignoreHTTPSErrors: true,
  reducedMotion: "reduce",
});
for (const width of [1440, 390]) {
  for (const language of ["fi", "en-US"]) {
    test(`dictation countdown, explanation and kept text ${width} ${language}`, async ({
      page,
    }) => {
      test.setTimeout(90_000);
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.addInitScript(() => {
        navigator.mediaDevices.getUserMedia = async () => {
          const context = new AudioContext();
          const tone = context.createOscillator();
          const output = context.createMediaStreamDestination();
          tone.connect(output);
          tone.start();
          return output.stream;
        };
      });
      await page.goto("/workspaces");
      await page.getByTestId("github-sign-in").click();
      await page.locator('a[href*="code=42"]').click();
      const session = await (await page.request.get("/auth/session")).json();
      for (const data of [
        { language },
        { experimental: { "explain-mode": true } },
      ]) {
        const response = await page.request.put("/api/v1/account/preferences", {
          headers: {
            Origin: new URL(page.url()).origin,
            "X-Agent-Host-CSRF": session.csrf,
          },
          data,
        });
        expect(response.ok(), await response.text()).toBe(true);
      }
      await page.goto("/settings/speech");
      await page
        .getByTestId("speech-key-input")
        .fill("syntheticSonioxKey00000000");
      await page.getByTestId("speech-key-save").click();
      await expect(page.getByTestId("speech-key-source")).toHaveAttribute(
        "data-source",
        "own",
      );
      const state = await (await page.request.get("/api/v1/snapshot")).json();
      const workspace = state.workspaces.find(
        (w: { name: string }) => w.name === "aurinkokello",
      );
      await page.goto(`/workspaces/${workspace.workspace_id}`);
      await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
      await expect(page).toHaveURL(/conversation=pi:/);
      await page.clock.install();
      await page.getByTestId("dictation-mic").click();
      await expect
        .poll(
          async () =>
            (
              await (
                await page.request.get("/fixture/soniox?action=state")
              ).json()
            ).open,
        )
        .toBe(1);
      await page.request.post("/fixture/soniox?action=say", {
        data: [{ text: "Synthetic dictated text.", is_final: true }],
      });
      await expect(page.getByTestId("dictation-final")).toHaveText(
        "Synthetic dictated text.",
      );
      await page.clock.fastForward("59:00");
      await expect(page.getByTestId("dictation-ceiling")).toHaveCount(0);
      await page.clock.fastForward("01:00:00");
      await expect(page.getByTestId("dictation-ceiling")).toBeVisible();
      await page.setViewportSize({ width, height: 900 });
      const capture = async (name: string) => {
        if (process.env.OH_VISUAL_CAPTURE !== "1") return;
        const base = `/var/tmp/agent-keep/rail-icons-dictation-sounds/dictation-${name}-${width}-${language}`;
        await snapshot(page, base, { labOrigin: new URL(page.url()).origin });
        await writeFile(
          `${base}.html`,
          (await readFile(`${base}.html`, "utf8")).replace(/[ \t]+$/gm, ""),
        );
      };
      for (const theme of ["light", "dark", "contrast"]) {
        await page.locator("html").evaluate((el, theme) => {
          el.dataset.theme = theme;
        }, theme);
        await expect(
          page.locator(".ah-dictation-time.countdown"),
        ).toBeInViewport();
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
        await capture(`minute-${theme}`);
      }
      expect(
        (await new AxeBuilder({ page }).include(".ah-composer").analyze())
          .violations,
      ).toEqual([]);
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.getByTestId("account-menu-trigger").click();
      await page.getByTestId("menu-explain").click();
      await page
        .getByTestId("start-page-title")
        .hover({ position: { x: 20, y: 10 } });
      await page.clock.runFor(100);
      await expect(page.getByTestId("explain-state-card")).toHaveCount(0);
      await page.setViewportSize({ width, height: 900 });
      await page.locator(".ah-dictation-time.countdown").hover();
      await expect(page.getByTestId("explain-card")).toHaveAttribute(
        "data-card",
        "V38",
      );
      await expect(page.getByTestId("explain-card")).toBeInViewport();
      await capture("explain");
      await page.getByTestId("explain-stop").click();
      await page.clock.fastForward("01:00");
      await expect(page.getByTestId("dictation-notice")).toHaveAttribute(
        "data-notice",
        "ceiling",
      );
      await expect(page.getByTestId("message-input")).toHaveValue(
        "Synthetic dictated text.",
      );
      await expect(page.getByTestId("dictation-resume")).toBeInViewport();
      await capture("limit");
      await page.getByTestId("dictation-resume").click();
      await expect(page.getByTestId("dictation-live")).toContainText(
        "Synthetic dictated text.",
      );
      await expect(page.getByTestId("dictation-announcement")).toBeEmpty();
      await page.getByTestId("dictation-stop").click();
    });
  }
}
