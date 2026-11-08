import AxeBuilder from "@axe-core/playwright";
import { hostOrigin } from "../test-ports.mjs";
import { expect, type Page, test } from "./worker-host";

// The person's server browser (experimental) through the real gateway and
// the real daemon routes and viewer relay. The browser host is the synthetic
// host's stand-in (test/browser-host/browser.go): its control socket answers
// from fixture state and its VNC socket is a tiny RFB server that counts the
// input it receives, so a look and control can be told apart. The real host
// with Xvnc and Chrome is proven in the Go tests and on Birch (result.md).
test.use({
  baseURL: hostOrigin,
  ignoreHTTPSErrors: true,
  viewport: { width: 1280, height: 800 },
  reducedMotion: "reduce",
});

test.beforeEach(async ({ page }) => {
  expect((await page.request.get("/fixture/reset-clock")).status()).toBe(204);
  expect(
    (await page.request.get("/fixture/conversations-reset")).status(),
  ).toBe(204);
});

async function signIn(page: Page, on: boolean) {
  await page.request.get("/fixture/scenario?value=ready");
  await page.goto("/workspaces");
  await page.getByTestId("github-sign-in").click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
  const session = await (await page.request.get("/auth/session")).json();
  if (on) {
    expect(
      (
        await page.request.put("/api/v1/account/preferences", {
          headers: {
            Origin: new URL(page.url()).origin,
            "X-Agent-Host-CSRF": session.csrf,
          },
          data: { experimental: { "remote-browser": true } },
        })
      ).ok(),
    ).toBe(true);
  }
  await page.reload();
  await expect(page.getByTestId("account-menu-trigger")).toBeAttached();
  return session.csrf as string;
}

async function fixture(page: Page, query: string) {
  const res = await page.request.get(`/fixture/browser?${query}`);
  expect(res.status()).toBeLessThan(300);
  return res;
}

async function input(page: Page) {
  return (await (await fixture(page, "input=1")).json()) as {
    pointer_events: number;
    key_events: number;
  };
}

const button = (page: Page, id: string) =>
  page.getByRole("button").and(page.getByTestId(id));

test("@server-browser is absent until the experiment is turned on", async ({
  page,
}) => {
  await signIn(page, false);
  await expect(page.getByTestId("workspace-git-project").first()).toBeVisible();
  await expect(page.getByTestId("browser-rail-row")).toHaveCount(0);
});

test("@server-browser opens from the rail; looking sends no input, control does", async ({
  page,
}, testInfo) => {
  test.setTimeout(90000);
  const csrf = await signIn(page, true);
  expect(
    (
      await page.request.put("/api/v1/account/preferences", {
        headers: {
          Origin: new URL(page.url()).origin,
          "X-Agent-Host-CSRF": csrf,
        },
        data: { experimental: { "explain-mode": true } },
      })
    ).ok(),
  ).toBeTruthy();
  await page.reload();
  await page.getByTestId("account-menu-trigger").click();
  await page.getByTestId("menu-explain").click();
  const row = button(page, "browser-rail-row");
  await expect(row).toHaveAttribute("data-state", "stopped");
  await row.click();
  const sheet = page.getByTestId("browser-sheet");
  await expect(sheet).toHaveAttribute("data-mode", "view");
  const viewer = page.getByTestId("browser-viewer");
  await expect(viewer).toHaveAttribute("data-phase", "connected", {
    timeout: 20000,
  });
  // The first picture sizes noVNC's canvas a moment after it connects.
  await expect
    .poll(
      async () => (await viewer.locator("canvas").boundingBox())?.width ?? 0,
    )
    .toBeGreaterThan(0);
  await expect(row).not.toHaveAttribute("data-state", "stopped");
  await page.screenshot({ path: testInfo.outputPath("sheet-view.png") });
  expect(
    (
      await new AxeBuilder({ page })
        .include('[data-testid="browser-sheet"]')
        .analyze()
    ).violations,
  ).toEqual([]);

  // Explain mode lets the look open, but holds control changes.
  await button(page, "browser-take-control").click();
  await expect(page.getByTestId("explain-card")).toHaveAttribute(
    "data-card",
    "B04",
  );
  await expect(page.locator(".ah-explain-toast")).toBeVisible();
  await expect(sheet).toHaveAttribute("data-mode", "view");
  await page.keyboard.press("Escape");
  await expect(sheet).toHaveCount(0);
  await page.getByTestId("explain-stop").click();
  await row.click();
  await expect(viewer).toHaveAttribute("data-phase", "connected");

  // A look is view-only: moving and pressing over the screen reaches
  // nothing in the browser.
  const canvas = viewer.locator("canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("no canvas");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.up();
  await page.keyboard.type("x");
  // The RFB server counts what arrives; give the relay time to deliver.
  await page.waitForTimeout(500);
  expect(await input(page)).toEqual({ pointer_events: 0, key_events: 0 });

  // Taking control lets the person's input through; the sheet says so.
  await button(page, "browser-take-control").click();
  await expect(sheet).toHaveAttribute("data-mode", "control");
  await canvas.click({ position: { x: 40, y: 40 } });
  await expect
    .poll(async () => (await input(page)).pointer_events)
    .toBeGreaterThan(0);

  // Giving it back returns to a look.
  await button(page, "browser-give-back").click();
  await expect(sheet).toHaveAttribute("data-mode", "view");
  await button(page, "browser-sheet-close").click();
  await expect(sheet).toHaveCount(0);
});

test("@server-browser a window's request opens the strip beside its picture and takes control in one press", async ({
  page,
}, testInfo) => {
  test.setTimeout(120000);
  await signIn(page, true);
  // Start the browser from the rail and leave the look.
  await button(page, "browser-rail-row").click();
  await expect(page.getByTestId("browser-sheet")).toBeVisible();
  await button(page, "browser-sheet-close").click();

  await page
    .getByRole("navigation")
    .getByTestId("workspace-git-project")
    .click();
  await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
  const pill = page.locator(".md-empty-picker");
  await pill.locator(":scope > summary").click();
  await pill.getByTestId("model-gpt-6-nova").check();
  await pill.getByTestId(/^(model-commit|conversation-model-start)$/).click();
  await page.getByTestId("message-input").fill("avaa selain");
  await page
    .getByTestId("send")
    .and(page.locator('[data-mode="send"]'))
    .click();
  await expect(
    page.getByText('Selvä. Kysyit: "avaa selain".').last(),
  ).toBeVisible({ timeout: 20000 });

  const chip = button(page, "browser-chip");
  await expect(chip).toHaveAttribute("data-state", "idle");
  await fixture(page, "agent=on");
  await fixture(page, "pointer=0.5,0.6");
  await expect(chip).toHaveAttribute("data-state", "agent");

  // The agent asks for the second window; the strip opens by itself with
  // that window large and the agent's own words beside it.
  const words = "Palvelu pyytää vahvistuskoodia <b>ei merkintää</b>";
  await fixture(page, `request=${encodeURIComponent(words)}&window=1`);
  await expect(chip).toHaveAttribute("data-state", "ask");
  const strip = page.getByTestId("browser-strip");
  await expect(strip).toBeVisible();
  await expect(strip.getByTestId("browser-request-text")).toHaveText(words);
  const lead = strip.locator(".sb-strip-lead [data-testid=browser-window]");
  await expect(lead).toHaveAttribute(
    "data-window",
    "F9E8D7C6B5A4938271605F4E3D2C1B0A",
  );
  // Pictures come through the daemon as images.
  await expect(
    strip.locator("[data-testid=browser-window] img").first(),
  ).toHaveAttribute("src", /^blob:/, { timeout: 10000 });
  // The agent's pointer is on the window it acts in (window 0).
  await expect(
    strip
      .locator('[data-window="0A1B2C3D4E5F60718293A4B5C6D7E8F9"]')
      .getByTestId("browser-pointer"),
  ).toBeAttached();
  await page.screenshot({ path: testInfo.outputPath("strip-ask.png") });

  await button(page, "browser-take-request").click();
  const sheet = page.getByTestId("browser-sheet");
  await expect(sheet).toHaveAttribute("data-mode", "control");
  await button(page, "browser-sheet-close").click();
  // Closing the look keeps control with the person until they give it back.
  await expect(chip).toHaveAttribute("data-state", "person");
  await expect(strip).toBeVisible();
  await button(page, "browser-give-back").click();
  // Giving control back clears the request the person answered.
  await expect(chip).toHaveAttribute("data-state", "agent");
  await expect(strip.getByTestId("browser-request")).toHaveCount(0);
});
