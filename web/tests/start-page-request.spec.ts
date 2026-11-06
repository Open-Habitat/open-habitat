import AxeBuilder from "@axe-core/playwright";
import { labOrigin } from "../test-ports.mjs";
import { expect, test } from "./lab-host";

test.use({
  baseURL: labOrigin,
  ignoreHTTPSErrors: true,
  reducedMotion: "reduce",
  deviceScaleFactor: 2,
});
for (const width of [1440, 390]) {
  test(`@lab prepared start-page request ${width}`, async ({
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
    if (width === 390) await page.getByTestId("navigation-open").click();
    await page
      .getByRole("navigation")
      .getByTestId("workspace-start-muistiinpanot")
      .click();
    await expect(page).toHaveURL(/\?conversation=pi:/);
    await expect(page.getByTestId("start-page-hint")).toBeVisible();
    await expect(page.getByTestId("start-page-create")).toHaveCount(0);
    const session = await (await page.request.get("/auth/session")).json();
    expect(
      (
        await page.request.put("/api/v1/account/preferences", {
          headers: {
            Origin: new URL(page.url()).origin,
            "X-Agent-Host-CSRF": session.csrf,
          },
          data: { experimental: { "empty-conversation-start-page": true } },
        })
      ).ok(),
    ).toBe(true);
    await page.reload();
    await expect(page.getByTestId("start-page-create")).toBeVisible();
    const { snapshot } = await import("../lab/session.mjs");
    const capture = async (name: string) => {
      await snapshot(page, testInfo.outputPath(name), { labOrigin });
      if (process.env.OH_VISUAL_CAPTURE === "1")
        await snapshot(
          page,
          `../issues/empty-conversation-start-page-button/evidence/${name}-${width}`,
          { labOrigin },
        );
    };
    await capture("empty");
    const sent: string[] = [];
    page.on("request", (r) => {
      if (
        r.method() === "POST" &&
        /\/(send|steer|follow_up)$/.test(new URL(r.url()).pathname)
      )
        sent.push(r.url());
    });
    const field = page.getByTestId("message-input");
    await field.fill("Keep my note [literal].");
    await page.getByTestId("start-page-create").click();
    await expect(page.getByTestId("goal-chip")).toBeVisible();
    await expect(field).toBeFocused();
    const prepared = await field.evaluate((node: HTMLTextAreaElement) => ({
      value: node.value,
      before: node.value.slice(0, node.selectionStart),
      selected: node.value.slice(node.selectionStart, node.selectionEnd),
      end: node.selectionEnd,
    }));
    expect(prepared.selected).toMatch(/^\[[^\]\n]+\]$/);
    expect(prepared.end).toBe(prepared.value.length);
    expect(prepared.before).toContain("Keep my note [literal].");
    expect(sent).toEqual([]);
    await page.getByTestId("start-page-create").click();
    await expect(field).toHaveValue(prepared.value);
    await capture("prepared");
    const audit = await new AxeBuilder({ page })
      .include('[data-testid="start-here"]')
      .analyze();
    expect(audit.violations).toEqual([]);
    // The cut is reconstructed from the draft and skill, not transient selection.
    await page.reload();
    await expect(page.getByTestId("goal-chip")).toBeVisible();
    await expect(field).toHaveValue(prepared.value);
    const sending = page.waitForRequest(
      (r) => r.method() === "POST" && /\/send$/.test(new URL(r.url()).pathname),
    );
    await field.press("Enter");
    const request = await sending;
    expect(request.postDataJSON().message).toBe(
      `/skill:open-habitat-start-page ${prepared.before.trimEnd()}`,
    );
    // The same rule applies to an authored goal; Pi records just its skill.
    await page.goto("/workspaces");
    if (width === 390) await page.getByTestId("navigation-open").click();
    await page
      .getByRole("navigation")
      .getByTestId("workspace-start-aurinkokello")
      .click();
    await expect(page).toHaveURL(/\?conversation=pi:/);
    await page.getByTestId("starting-goal").first().click();
    await expect(page.getByTestId("goal-chip")).toBeVisible();
    await page.reload();
    await expect(page.getByTestId("goal-chip")).toBeVisible();
    const goalSend = page.waitForRequest(
      (r) => r.method() === "POST" && /\/send$/.test(new URL(r.url()).pathname),
    );
    await field.press("Enter");
    expect((await goalSend).postDataJSON().message).toBe(
      "/skill:korjaa-ongelma",
    );
    const recorded = page.getByTestId("skill-chip").first();
    await expect(recorded).toBeVisible();
    const message = page.getByTestId("message").filter({ has: recorded });
    await expect(message.getByTestId("user-content")).toBeEmpty();
  });
}
