import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { labOrigin } from "../test-ports.mjs";
import { expectPhoneMenuPanel } from "./conversation-view";
import { expect, test } from "./lab-host";

// axe reads colours as painted, so text under a fade still running (a
// banner's appear, the frame's entry) fails contrast at partial opacity.
// The audits are of the settled view: wait for every finite animation and
// transition first.
const settled = (page: Page) =>
  page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((a) => a.effect?.getComputedTiming().endTime !== Infinity)
        .map((a) => a.finished.catch(() => undefined)),
    ),
  );

test.use({ baseURL: labOrigin, ignoreHTTPSErrors: true });
for (const width of [1440, 390]) {
  for (const theme of ["light", "dark"]) {
    test(`@lab @a11y authored start page and safe draft ${width} ${theme}`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize({ width, height: 900 });
      await page.request.get("/fixture/conversations-reset");
      await page.request.get("/fixture/scenario?value=ready");
      await page.goto("/workspaces");
      await page.getByTestId("github-sign-in").click();
      await page
        .getByRole("link")
        .and(page.locator('a[href*="code=42"]'))
        .click();
      await page.evaluate((t) => {
        document.documentElement.dataset.theme = t;
      }, theme);
      if (width === 390) await page.getByTestId("navigation-open").click();
      const fileResponse = page.waitForResponse((r) =>
        r.url().includes("/workspaces/start_page?"),
      );
      await page
        .getByRole("navigation")
        .getByTestId("workspace-start-aurinkokello")
        .click();
      // The authored page is also shown during creation. Wait for the durable
      // conversation before testing focus: the handoff replaces the composer.
      await expect(page).toHaveURL(/\?conversation=pi:/);
      const field = page.getByTestId("message-input");
      // Compare the old combined endpoint with the file-only path on the same
      // synthetic host. These are observations, not a flaky speed threshold.
      const resource = await fileResponse;
      const startURL = resource.url();
      const timings: Record<string, number[]> = {};
      for (const [name, url] of [
        ["file_only", startURL],
        ["old_combined", startURL.replace("/start_page?", "/commands?")],
      ]) {
        timings[name] = [];
        for (let i = 0; i < 3; i++) {
          const start = performance.now();
          const response = await page.request.get(url);
          expect(response.ok()).toBe(true);
          timings[name].push(performance.now() - start);
        }
      }
      const reads = await page.evaluate(() =>
        performance
          .getEntriesByType("resource")
          .filter((e) => e.name.includes("/api/v1/"))
          .map((e) => ({ url: new URL(e.name).pathname, ms: e.duration })),
      );
      console.info(
        "start-page timing",
        JSON.stringify({ width, theme, timings, reads }),
      );
      await testInfo.attach("initial-read-timings", {
        body: JSON.stringify(reads),
        contentType: "application/json",
      });
      await testInfo.attach("start-page-timings", {
        body: JSON.stringify(timings),
        contentType: "application/json",
      });
      await expect(page.getByTestId("starting-goal")).toHaveCount(6);
      // Repository-authored content is a contract, not product wording.
      await expect(page.getByTestId("start-page-title")).toHaveText(
        "Aurinkopolku",
      );
      await expect(
        page.getByTestId("start-page-body").locator("strong"),
      ).toHaveText("retkireittien suunnittelija");
      const sent: string[] = [];
      page.on("request", (r) => {
        if (
          r.method() === "POST" &&
          /\/(send|steer|follow_up)$/.test(new URL(r.url()).pathname)
        )
          sent.push(r.url());
      });
      await expect(page.getByTestId("start-page-title")).toBeInViewport();
      const { snapshot } = await import("../lab/session.mjs");
      await snapshot(page, testInfo.outputPath(`home-${width}-${theme}`), {
        labOrigin,
      });
      await field.fill("Oma keskeneräinen ajatus.");
      // Choosing a goal is its Aloita (Jari 29.10.2026): no guide stops in
      // between, and the guide stays reachable beside the conversation.
      await page.getByTestId("starting-goal").first().focus();
      await page.keyboard.press("Enter");
      await expect(page.getByTestId("goal-guide")).toHaveCount(0);
      // The goal's own skill carries the request; the chip shows its call.
      await expect(page.getByTestId("goal-chip")).toBeVisible();
      await expect(field).toHaveValue(
        "Oma keskeneräinen ajatus.\n\n[kuvaile havainto]",
      );
      await expect(field).toBeFocused();
      expect(
        await field.evaluate((node: HTMLTextAreaElement) =>
          node.value.slice(node.selectionStart, node.selectionEnd),
        ),
      ).toBe("[kuvaile havainto]");
      if (width === 1440)
        await expect(page.getByTestId("guide-panel")).toBeVisible();
      else {
        // A phone opens nothing by itself over the field just filled; the
        // top bar's ⋯ menu reaches the guide.
        await expect(page.getByTestId("guide-panel")).toHaveCount(0);
        await expectPhoneMenuPanel(page, "guide-toggle");
      }
      await snapshot(
        page,
        testInfo.outputPath(`placeholder-${width}-${theme}`),
        {
          labOrigin,
        },
      );
      await field.press("X");
      await expect(field).toHaveValue("Oma keskeneräinen ajatus.\n\nX");
      await page.getByTestId("goal-chip-remove").click();
      await field.fill("Oma keskeneräinen ajatus.");
      await page.getByTestId("starting-goal").nth(1).click();
      const withDraft =
        "Lue repon ohjeet ja kerro lyhyesti, mitä Aurinkopolku tekee. Näytä tärkeimmät hakemistot ja mistä testit ajetaan. Älä muuta tiedostoja.\n\nOma keskeneräinen ajatus.\n\n";
      await expect(field).toHaveValue(withDraft);
      await expect(field).toBeFocused();
      expect(
        await field.evaluate((node: HTMLTextAreaElement) => [
          node.selectionStart,
          node.selectionEnd,
        ]),
      ).toEqual([withDraft.length, withDraft.length]);
      await field.press("X");
      await expect(field).toHaveValue(`${withDraft}X`);
      await field.fill("");
      await page.getByTestId("starting-goal").nth(2).click();
      await expect(field).toHaveValue(
        /docs\/esimerkit\/erittain-pitka-synteettinen-julkaisun-valmistelun-tarkistuslistan-tiedostonimi\.md/,
      );
      await snapshot(page, testInfo.outputPath(`request-${width}-${theme}`), {
        labOrigin,
      });
      await field.fill("");
      await page.getByTestId("starting-goal").nth(1).click();
      await expect(field).toHaveValue(
        "Lue repon ohjeet ja kerro lyhyesti, mitä Aurinkopolku tekee. Näytä tärkeimmät hakemistot ja mistä testit ajetaan. Älä muuta tiedostoja.\n\n",
      );
      await expect(field).toBeFocused();
      expect(
        await field.evaluate(
          (node: HTMLTextAreaElement) =>
            node.selectionStart === node.value.length &&
            node.selectionEnd === node.value.length,
        ),
      ).toBe(true);
      expect(sent).toEqual([]);
      await expect(page.getByTestId("user-content")).toHaveCount(0);
      await settled(page);
      const audit = await new AxeBuilder({ page })
        .include('[data-testid="start-here"]')
        .analyze();
      expect(audit.violations).toEqual([]);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.reload();
      await page.evaluate((t) => {
        document.documentElement.dataset.theme = t;
      }, theme);
      await expect(field).toHaveValue(
        "Lue repon ohjeet ja kerro lyhyesti, mitä Aurinkopolku tekee. Näytä tärkeimmät hakemistot ja mistä testit ajetaan. Älä muuta tiedostoja.\n\n",
      );
      await page.goto("/workspaces");
      if (width === 390) await page.getByTestId("navigation-open").click();
      await page
        .getByRole("navigation")
        .getByTestId("workspace-start-muistiinpanot")
        .click();
      // Reload below must reopen a confirmed conversation, not abandon an
      // in-flight creation route whose page already happens to be visible.
      await expect(page).toHaveURL(/\?conversation=pi:/);
      await expect(page.getByTestId("start-page-create")).toBeVisible();
      await expect(page.getByTestId("starting-goal")).toHaveCount(0);
      await expect(page.getByTestId("start-page-title")).toHaveCount(0);
      await snapshot(page, testInfo.outputPath(`absent-${width}-${theme}`), {
        labOrigin,
      });
      // Exercise the validated command-list boundary, not a transport error.
      await page.route("**/api/v1/workspaces/start_page*", async (route) => {
        const response = await route.fetch();
        const list = await response.json();
        await route.fulfill({
          response,
          json: { ...list, start_page: { state: "needs_update" } },
        });
      });
      await field.fill("Oma keskeneräinen ajatus.");
      await page.reload();
      await page.evaluate((t) => {
        document.documentElement.dataset.theme = t;
      }, theme);
      await expect(page.getByTestId("start-page-needs-update")).toBeVisible();
      await expect(page.getByTestId("start-page-create")).toHaveCount(0);
      await expect(page.getByTestId("starting-goal")).toHaveCount(0);
      await expect(field).toHaveValue("Oma keskeneräinen ajatus.");
      await settled(page);
      const unavailableAudit = await new AxeBuilder({ page })
        .include('[data-testid="start-here"]')
        .analyze();
      expect(unavailableAudit.violations).toEqual([]);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await snapshot(
        page,
        testInfo.outputPath(`needs-update-${width}-${theme}`),
        {
          labOrigin,
        },
      );
      expect(sent).toEqual([]);
      // A typed short skill crosses the real composer/actions/send boundary
      // as Pi's native invocation; accepted receipts still clear the draft.
      await page.unroute("**/api/v1/workspaces/start_page*");
      const outgoing = page.waitForRequest(
        (r) =>
          r.method() === "POST" && new URL(r.url()).pathname.endsWith("/send"),
      );
      await field.fill("/pytest-debug Synthetic alias check");
      await page.getByTestId("send").click();
      const submission = await outgoing;
      expect(submission.postDataJSON().message).toBe(
        "/skill:pytest-debug Synthetic alias check",
      );
      await expect(field).toHaveValue("");
      const workspaceId = new URL(startURL).searchParams.get("workspace_id");
      await page.goto(`/workspaces/${workspaceId}?conversation=new-worktree`);
      await expect(page.getByTestId("worktree-intro")).toBeVisible();
      const creatingAudit = await new AxeBuilder({ page })
        .include("main")
        .analyze();
      expect(creatingAudit.violations).toEqual([]);
      const firstSend = page.waitForRequest(
        (r) =>
          r.method() === "POST" && new URL(r.url()).pathname.endsWith("/send"),
      );
      await field.fill("/pytest-debug Synthetic worktree alias check");
      await page.getByTestId("send").click();
      expect((await firstSend).postDataJSON().message).toBe(
        "/skill:pytest-debug Synthetic worktree alias check",
      );
      await expect(field).toHaveValue("");
    });
  }
}
