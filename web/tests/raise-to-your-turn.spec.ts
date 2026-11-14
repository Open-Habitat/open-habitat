import type { Browser } from "@playwright/test";
import { hostOrigin } from "../test-ports.mjs";
import { expect, type Page, test } from "./worker-host";

test.use({
  baseURL: hostOrigin,
  ignoreHTTPSErrors: true,
  viewport: { width: 1280, height: 900 },
});

// Nosta and Ei nyt (raise-to-your-turn): one mark the person's
// daemon keeps, shown alike on two devices (two browser contexts of the same
// person, each with its own browser storage).
async function signIn(page: Page) {
  await page.goto(`${hostOrigin}/workspaces`);
  await page.getByTestId("github-sign-in").click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
  await expect(page.getByTestId("rail-yours")).toBeVisible();
}
async function device(browser: Browser) {
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    viewport: { width: 1280, height: 900 },
  });
  return context.newPage();
}
const row = (page: Page, section: string, id: string) =>
  page.getByTestId(section).getByTestId(`agent-item-${id}`);
async function markOnHost(page: Page, id: string) {
  const snapshot = await (await page.request.get("/api/v1/snapshot")).json();
  return snapshot.agents.find((a: { agent_id: string }) => a.agent_id === id)
    ?.turn_mark?.state as string | undefined;
}

/** Hover the row and press its up or down button. */
async function press(page: Page, section: string, id: string, button: string) {
  const r = row(page, section, id);
  await r.hover();
  await r.getByTestId(`rail-${button}-conversation`).click();
}

test("@raise-to-your-turn Ei nyt and Nosta hold on every device until the person replies", async ({
  page,
  browser,
}) => {
  test.setTimeout(150000);
  await page.request.get("/fixture/scenario?value=ready");
  await signIn(page);
  await page
    .getByRole("navigation")
    .getByTestId("workspace-ordinary-dir")
    .click();
  await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
  await expect(page).toHaveURL(/conversation=pi(?:%3A|:)/);
  const id = new URL(page.url()).searchParams.get("conversation") ?? "";
  await page.getByTestId("message-input").fill("first");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("composer-stop")).toHaveCount(0, {
    timeout: 30000,
  });
  const quietHere = row(page, "rail-quiet", id);
  // By default it waits read in Sinun vuorosi with a ring, and only the rail row
  // says Ei nyt: the composer has no turn button (Jari 7.11.2026).
  const yours = row(page, "rail-yours", id);
  await expect(yours).toBeVisible();
  await expect(yours.getByTestId("rail-mark")).toHaveAttribute(
    "data-state",
    "read",
  );
  await expect(page.locator(".ah-crow")).not.toContainText("Ei nyt");
  await expect(page.locator(".ah-crow")).not.toContainText("Nosta");
  await press(page, "rail-yours", id, "not-now");
  await expect(quietHere).toBeVisible();
  await expect.poll(() => markOnHost(page, id)).toBe("not_now");

  // Another device of the same person, whose browser never showed the reply.
  const other = await device(browser);
  await signIn(other);
  await expect(row(other, "rail-quiet", id)).toBeVisible();
  await expect(row(other, "rail-yours", id)).toHaveCount(0);

  // Raised from this rail: the row leads Sinun vuorosi, and its mark is
  // still the agent's state, not an arrow.
  await press(page, "rail-quiet", id, "raise");
  await expect(yours).toBeVisible();
  await expect(yours.getByTestId("rail-mark")).not.toHaveAttribute(
    "data-state",
    "read",
  );
  await expect(page.locator(".ah-crow")).not.toContainText("Sinun vuorossasi");
  // The other device follows the host's event without a reload.
  const there = row(other, "rail-yours", id);
  await expect(there).toBeVisible({ timeout: 15000 });
  // Lowered from that device's rail row, without opening it.
  await press(other, "rail-yours", id, "lower");
  await expect(row(other, "rail-quiet", id)).toBeVisible();
  await expect(quietHere).toBeVisible({ timeout: 15000 });

  // Raised from the rail row there, and it stays through a reload here.
  await press(other, "rail-quiet", id, "raise");
  await expect(row(other, "rail-yours", id)).toBeVisible();
  await page.reload();
  await expect(yours).toBeVisible({ timeout: 15000 });
  await yours.hover();
  await expect(yours.getByTestId("rail-lower-conversation")).toBeVisible();

  // Replying ends the raise on the host; the agent's answer asks anew.
  await page.getByTestId("message-input").fill("second");
  await page.getByTestId("send").click();
  await expect
    .poll(() => markOnHost(page, id), { timeout: 30000 })
    .toBe(undefined);
  await expect(page.getByTestId("composer-stop")).toHaveCount(0, {
    timeout: 30000,
  });
  const answered = row(other, "rail-yours", id);
  await expect(answered).toBeVisible({ timeout: 15000 });
  await answered.hover();
  await expect(answered.getByTestId("rail-not-now-conversation")).toBeVisible();
});
