import { expect } from "@playwright/test";
import { openLab, origin, snapshot } from "./session.mjs";

for (const locale of ["fi-FI", "en-US"]) {
  const { browser, page } = await openLab({ locale });
  try {
    await page.emulateMedia({ reducedMotion: "reduce" });
    const session = await (
      await page.request.get(`${origin}/auth/session`)
    ).json();
    await page.request.put(`${origin}/api/v1/account/preferences`, {
      headers: { Origin: origin, "X-Agent-Host-CSRF": session.csrf },
      data: { experimental: { "explain-mode": true } },
    });
    await page.reload();
    const workspace = await page
      .getByRole("navigation")
      .getByRole("link", { name: "aurinkokello", exact: true })
      .first()
      .getAttribute("href");
    await page.goto(`${origin}${workspace}`);
    await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
    await page.getByTestId("message-input").waitFor();
    await page.route("**/api/v1/workspaces/terminals?*", (route) =>
      route.fulfill({ status: 503, body: "" }),
    );
    await page.getByTestId("toggle-terminal").click();
    await page.getByTestId("terminal-event-notice").waitFor();
    await page.getByTestId("explain-toggle").click();
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await page
        .getByTestId("terminal-event-notice")
        .locator(".ah-warning-content")
        .hover();
      await expect(page.getByTestId("explain-card")).toHaveAttribute(
        "data-card",
        "Y25",
      );
      await snapshot(
        page,
        `issues/notices-app-wide/evidence/explain-terminal-${locale}-${width}`,
      );
    }
    await page.getByTestId("explain-stop").click();
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.getByTestId("message-input").fill("Synthetic archive notice");
    await page.getByTestId("send").click();
    const id = new URL(page.url()).searchParams.get("conversation");
    await page.route("**/api/v1/workspaces", (route) => {
      if (route.request().postDataJSON()?.action !== "conversation_archive")
        return route.continue();
      return route.fulfill({
        status: 409,
        contentType: "application/json",
        body: JSON.stringify({ error: { code: "control_uncertain" } }),
      });
    });
    const row = page.getByRole("navigation").getByTestId(`agent-item-${id}`);
    await row.hover();
    await row.getByTestId("rail-archive-conversation").click();
    await page.getByTestId("archive-error").waitFor();
    await page.getByTestId("account-menu-trigger").click();
    await page.getByTestId("menu-explain").click();
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await page.getByTestId("archive-error").hover();
      await expect(page.getByTestId("explain-card")).toHaveAttribute(
        "data-card",
        "Y18",
      );
      await snapshot(
        page,
        `issues/notices-app-wide/evidence/explain-archive-${locale}-${width}`,
      );
    }
  } finally {
    await browser.close();
  }
}
