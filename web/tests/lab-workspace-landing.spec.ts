import AxeBuilder from "@axe-core/playwright";
import { snapshot } from "../lab/session.mjs";
import { labOrigin } from "../test-ports.mjs";
import { expect, test } from "./lab-host";

// The workspace page shows the repository's start page (Esittely), and a
// goal chosen there lands in a new conversation with its request already in
// the field: no guide or Aloita stop, the placeholder selected (Jari
// 29.10.2026). Viewing the page creates nothing.
test.use({ baseURL: labOrigin, ignoreHTTPSErrors: true });
for (const [width, theme] of [
  [1440, "light"],
  [390, "dark"],
] as const) {
  test(`@lab @a11y workspace landing and goal start ${width} ${theme}`, async ({
    page,
  }, testInfo) => {
    const phone = width === 390;
    await page.setViewportSize({ width, height: 900 });
    await page.request.get("/fixture/conversations-reset");
    await page.request.get("/fixture/scenario?value=ready");
    await page.goto("/workspaces");
    await page.getByTestId("github-sign-in").click();
    await page.locator('a[href*="code=42"]').click();
    await page.evaluate((t) => {
      document.documentElement.dataset.theme = t;
    }, theme);
    const writes: string[] = [];
    page.on("request", (r) => {
      if (r.method() === "POST") writes.push(new URL(r.url()).pathname);
    });
    const openWorkspace = async (name: string) => {
      if (phone) await page.getByTestId("navigation-open").click();
      await page
        .getByRole("navigation")
        .getByTestId(`workspace-${name}`)
        .click();
    };
    await openWorkspace("aurinkokello");
    const landing = page.getByTestId("landing");
    await expect(landing).toBeVisible();
    // Repository-authored content is shown unchanged.
    await expect(page.getByTestId("landing-title")).toHaveText("Aurinkopolku");
    const body = page.getByTestId("landing-body");
    await expect(body.locator("strong")).toHaveText(
      "retkireittien suunnittelija",
    );
    await expect(body).not.toContainText("make test");
    await page.getByTestId("landing-more").click();
    await expect(body.locator("code")).toHaveText("make test");
    await expect(page.getByTestId("landing-more")).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    await expect(landing.getByTestId("starting-goal")).toHaveCount(6);
    // The landing comes before Git and the conversations.
    const landingBox = await landing.boundingBox();
    const openBox = await page.getByTestId("open-conversations").boundingBox();
    if (!landingBox || !openBox) throw new Error("landing or list missing");
    expect(landingBox.y + landingBox.height).toBeLessThanOrEqual(openBox.y);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const audit = await new AxeBuilder({ page })
      .include('[data-testid="landing"]')
      .analyze();
    expect(audit.violations).toEqual([]);
    await snapshot(page, testInfo.outputPath(`landing-${width}-${theme}`), {
      labOrigin,
    });
    // Reading the page and its start page creates no conversation.
    expect(writes).not.toContain("/api/v1/conversations");

    // The first goal has its own skill and a placeholder.
    await landing.getByTestId("starting-goal").first().click();
    await expect(page).toHaveURL(/\?conversation=pi:/);
    const field = page.getByTestId("message-input");
    await expect(page.getByTestId("goal-guide")).toHaveCount(0);
    await expect(page.getByTestId("goal-chip")).toBeVisible();
    await expect(field).toHaveValue("[kuvaile havainto]");
    await expect(field).toBeFocused();
    expect(
      await field.evaluate((node: HTMLTextAreaElement) =>
        node.value.slice(node.selectionStart, node.selectionEnd),
      ),
    ).toBe("[kuvaile havainto]");
    const panel = page.getByTestId("guide-panel");
    if (phone) {
      // A phone opens nothing over the field; the top bar reaches the guide.
      await expect(panel).toHaveCount(0);
      await expect(page.getByTestId("guide-toggle")).toBeVisible();
    } else await expect(panel).toBeVisible();
    await snapshot(page, testInfo.outputPath(`started-${width}-${theme}`), {
      labOrigin,
    });
    await field.press("X");
    await expect(field).toHaveValue("X");
    // Nothing is sent until the person sends it.
    expect(writes.filter((w) => /\/(send|steer|follow_up)$/.test(w))).toEqual(
      [],
    );

    // Without a start page the landing offers to write one.
    await openWorkspace("muistiinpanot");
    await expect(page.getByTestId("landing-absent")).toBeVisible();
    await expect(page.getByTestId("landing")).toHaveCount(0);
    const absentAudit = await new AxeBuilder({ page })
      .include('[data-testid="landing-absent"]')
      .analyze();
    expect(absentAudit.violations).toEqual([]);
    await snapshot(page, testInfo.outputPath(`absent-${width}-${theme}`), {
      labOrigin,
    });
    await page.getByTestId("landing-create").click();
    await expect(page).toHaveURL(/\?conversation=pi:/);
    // The executable command is the contract.
    await expect(field).toHaveValue("/skill:open-habitat-start-page ");
    await expect(field).toBeFocused();
    expect(
      await field.evaluate(
        (node: HTMLTextAreaElement) =>
          node.selectionStart === node.value.length &&
          node.selectionEnd === node.value.length,
      ),
    ).toBe(true);
    const outgoing = page.waitForRequest(
      (r) =>
        r.method() === "POST" && new URL(r.url()).pathname.endsWith("/send"),
    );
    await page.getByTestId("send").click();
    expect((await outgoing).postDataJSON().message).toBe(
      "/skill:open-habitat-start-page ",
    );
  });
}
