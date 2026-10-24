import { hostOrigin } from "../test-ports.mjs";
import { confirmGitIdentity } from "./git-identity-helper";
import { expect, type Page, test } from "./worker-host";

const host = hostOrigin;
test.use({ baseURL: host, ignoreHTTPSErrors: true });
async function login(page: Page, name: "Alice" | "Bob" = "Alice") {
  await page.goto("/workspaces");
  await page
    .getByRole("button")
    .and(page.getByTestId("github-sign-in"))
    .click();
  await page
    .getByRole("link")
    .nth(name === "Alice" ? 0 : 1)
    .click();
  await confirmGitIdentity(page);
  await page
    .getByRole("button")
    .and(page.getByTestId("repository-proceed"))
    .click();
}
async function scenario(page: Page, value: string) {
  expect(
    (await page.request.get(`/fixture/scenario?value=${value}`)).status(),
  ).toBe(204);
}
test("@pi-onboarding native attempt drives the production browser, never a callback", async ({
  browser,
}, testInfo) => {
  const a = await browser.newContext({
    baseURL: host,
    ignoreHTTPSErrors: true,
  });
  const b = await browser.newContext({
    baseURL: host,
    ignoreHTTPSErrors: true,
  });
  const page = await a.newPage();
  const foreign = await b.newPage();
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  try {
    await scenario(page, "pi-onboarding");
    await page.request.get("/fixture/pi-state?value=missing");
    await login(page);
    // Establish the foreign session before starting the timed fake Pi child.
    // Logging in after the child starts can exceed its two-second response
    // window or change the synthetic Pi state before Bob reaches onboarding.
    await login(foreign, "Bob");
    await expect(
      page.getByRole("heading").and(page.getByTestId("pi-sign-in-title")),
    ).toBeVisible();
    await expect(page.getByTestId("workspace-git-project")).toHaveCount(0);
    expect((await page.request.get("/api/v1/snapshot")).status()).toBe(200);
    expect(
      (
        await page.request.get(
          "/api/v1/agents/pi:11111111-1111-4111-8111-111111111111/history?limit=1",
        )
      ).status(),
    ).toBe(200);
    await page
      .getByRole("button")
      .and(page.getByTestId("pi-attempt-start"))
      .click();
    await expect(page.getByTestId("pi-device-code")).toHaveText("ABCD-1234");
    await expect(page.getByTestId("pi-device-code")).toBeVisible();
    expect(page.url()).not.toContain("ABCD-1234");
    await page.screenshot({
      path: testInfo.outputPath("pi-device-code.png"),
      fullPage: true,
    });
    // The fake Pi checks this state after a two-second delay; do not put
    // another OAuth journey between device-code display and this switch.
    await page.request.get("/fixture/pi-state?value=usable");
    await expect(foreign.getByTestId("pi-device-code")).toHaveCount(0);
    expect(
      (await foreign.request.get("/api/v1/onboarding/pi/attempt")).status(),
    ).toBe(404);
    await expect(
      page.getByRole("heading").and(page.getByTestId("workspaces-title")),
    ).toBeVisible({
      timeout: 12000,
    });
    await expect(page.getByTestId("pi-device-code")).toHaveCount(0);
    await page.screenshot({
      path: testInfo.outputPath("pi-workspaces.png"),
      fullPage: true,
    });
    expect(errors.join(" ")).not.toContain("ABCD-1234");
  } finally {
    await page.request.get("/fixture/pi-state?value=missing");
    await scenario(page, "ready");
    await a.close();
    await b.close();
  }
});

test("@pi-onboarding cancel, unknown, expiry and stale session fail closed", async ({
  browser,
}, testInfo) => {
  const context = await browser.newContext({
    baseURL: host,
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();
  try {
    await scenario(page, "pi-onboarding");
    await page.request.get("/fixture/pi-state?value=missing");
    await login(page);
    await page
      .getByRole("button")
      .and(page.getByTestId("pi-attempt-start"))
      .click();
    await expect(page.getByTestId("pi-device-code")).toHaveText("ABCD-1234");
    await expect(page.getByTestId("pi-device-code")).toBeVisible();
    await page
      .getByRole("button")
      .and(page.getByTestId("pi-attempt-cancel"))
      .click();
    await expect(page.getByTestId("pi-device-code")).toHaveCount(0);
    await page.request.get("/fixture/pi-state?value=unknown");
    await expect(
      page.getByRole("heading").and(page.getByTestId("pi-attempt-interrupted")),
    ).toBeVisible({ timeout: 9000 });
    await page
      .getByRole("button")
      .and(page.getByTestId("notice-action"))
      .click();
    await expect(page.getByTestId("workspaces-title")).toHaveCount(0);
    await page.request.get("/fixture/expire");
    await page.reload();
    await expect(
      page.getByRole("button").and(page.getByTestId("github-sign-in")),
    ).toBeVisible();
    await expect(page.getByTestId("pi-device-code")).toHaveCount(0);
    await page.screenshot({
      path: testInfo.outputPath("pi-expired-session.png"),
      fullPage: true,
    });
  } finally {
    await page.request.get("/fixture/reset-clock");
    await page.request.get("/fixture/pi-state?value=missing");
    await scenario(page, "ready");
    await context.close();
  }
});

test("@pi-onboarding code disappearance stays uncertain through polling, focus and a slow read until explicit retry", async ({
  browser,
}) => {
  const context = await browser.newContext({
    baseURL: host,
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();
  let release: (() => void) | undefined;
  let slowReads = 0;
  let starts = 0;
  page.on("request", (request) => {
    if (
      request.method() === "POST" &&
      request.url().endsWith("/onboarding/pi/attempt")
    )
      starts++;
  });
  try {
    await scenario(page, "pi-onboarding");
    await page.request.get("/fixture/pi-state?value=missing");
    await login(page);
    await page
      .getByRole("button")
      .and(page.getByTestId("pi-attempt-start"))
      .click();
    await expect(page.getByTestId("pi-device-code")).toHaveText("ABCD-1234");
    await expect(page.getByTestId("pi-device-code")).toBeVisible();
    // Native unknown alone retains its lease. A synthetic daemon restart
    // removes that lease without making a claim about provider consent.
    await expect(
      page.getByRole("heading").and(page.getByTestId("pi-attempt-interrupted")),
    ).toBeVisible({ timeout: 12000 });
    expect((await page.request.get("/fixture/pi-restart")).status()).toBe(204);
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect(page.getByTestId("pi-sign-in-card")).toHaveAttribute(
      "data-phase",
      "expired",
      {
        timeout: 12000,
      },
    );
    await expect(page.getByTestId("pi-sign-in-card")).toBeVisible({
      timeout: 12000,
    });
    await expect(page.getByTestId("pi-device-code")).toHaveCount(0);
    expect(starts).toBe(1);

    // Observe every render, not just the state at the end of the poll interval.
    await page.evaluate(() => {
      (window as Window & { piLabels?: string[] }).piLabels = [];
      new MutationObserver(() => {
        const text = document.body.innerText;
        for (const label of [
          "ChatGPT-kirjautuminen tarvitaan",
          "Tarkistetaan tilaa",
        ]) {
          if (text.includes(label))
            (window as Window & { piLabels?: string[] }).piLabels?.push(label);
        }
      }).observe(document.body, {
        childList: true,
        characterData: true,
        subtree: true,
      });
    });
    await page.route("**/api/v1/onboarding/pi/status", async (route) => {
      if (slowReads++ === 0) {
        await new Promise<void>((resolve) => {
          release = resolve;
        });
      }
      await route.continue();
    });
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect.poll(() => slowReads).toBe(1);
    await page.clock.fastForward(3600); // One poll interval while the read is still in flight.
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    expect(slowReads).toBe(1); // Single-flight; focus does not launch another read.
    await expect(page.getByTestId("pi-sign-in-card")).toHaveAttribute(
      "data-phase",
      "expired",
    );
    await expect(page.getByTestId("pi-sign-in-card")).toBeVisible();
    release?.();
    await page.clock.fastForward(6500); // Two more poll intervals.
    await expect(page.getByTestId("pi-sign-in-card")).toHaveAttribute(
      "data-phase",
      "expired",
    );
    await expect(page.getByTestId("pi-sign-in-card")).toBeVisible();
    expect(
      await page.evaluate(
        () => (window as Window & { piLabels?: string[] }).piLabels,
      ),
    ).toEqual([]);
    expect(starts).toBe(1);
    await page
      .getByRole("button")
      .and(page.getByTestId("pi-attempt-start"))
      .click();
    await expect(page.getByTestId("pi-device-code")).toHaveText("ABCD-1234");
    await expect(page.getByTestId("pi-device-code")).toBeVisible();
    expect(starts).toBe(2);
  } finally {
    release?.();
    await page.unrouteAll({ behavior: "ignoreErrors" });
    await page.request.get("/fixture/pi-state?value=missing");
    await scenario(page, "ready");
    await context.close();
  }
});
