import { hostOrigin } from "../test-ports.mjs";
import { expect, type Page, test } from "./worker-host";

test.use({
  baseURL: hostOrigin,
  ignoreHTTPSErrors: true,
  viewport: { width: 1280, height: 720 },
});

// Samples the landing's opacity on every frame from navigation start, so the
// assertions see what the person saw, including the static index.html copy.
async function sampleLanding(page: Page) {
  await page.addInitScript(() => {
    const samples: { t: number; visible: boolean }[] = [];
    (window as unknown as { __landing: typeof samples }).__landing = samples;
    const frame = () => {
      const landing = document.querySelector(".ah-landing-in");
      samples.push({
        t: performance.now(),
        visible: !!landing && Number(getComputedStyle(landing).opacity) > 0,
      });
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });
}
async function shownSpan(page: Page) {
  const samples = await page.evaluate(
    () =>
      (window as unknown as { __landing: { t: number; visible: boolean }[] })
        .__landing,
  );
  const visible = samples.filter((s) => s.visible);
  if (!visible.length) return undefined;
  const first = visible[0].t;
  // The span ends at the first hidden frame after the landing showed.
  const end = samples.find((s) => s.t > first && !s.visible)?.t;
  return { first, end };
}
async function login(page: Page) {
  await page.goto("/workspaces");
  await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
  await page.getByRole("link", { name: "Alice" }).click();
  await expect(
    page.getByRole("navigation", { name: "Työtilat ja keskustelut" }),
  ).toBeVisible();
}

test("@landing never flashes: hidden for 300 ms from navigation, then shown at least 500 ms", async ({
  page,
}) => {
  await page.request.get("/fixture/scenario?value=ready");
  await login(page);
  await sampleLanding(page);
  // An ordinary local load: if it finishes within 300 ms the landing never
  // shows; if it shows, it must obey the same rules as a slow load.
  await page.reload();
  await expect(
    page.getByRole("navigation", { name: "Työtilat ja keskustelut" }),
  ).toBeVisible();
  const fast = await shownSpan(page);
  if (fast) {
    expect(fast.first).toBeGreaterThanOrEqual(300);
    expect(fast.end, "landing never left").toBeDefined();
    expect((fast.end ?? 0) - fast.first).toBeGreaterThanOrEqual(480);
  }
  // A snapshot that answers the moment the landing has appeared: without the
  // minimum time it would vanish again within a frame or two.
  let release = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/v1/snapshot", async (route) => {
    await held;
    await route.continue();
  });
  await page.reload();
  await expect(page.getByRole("status")).toHaveText(
    "Hei Alice. Haetaan työtilojasi…",
  );
  await expect(page.locator(".ah-landing-server")).toHaveText("127.0.0.1");
  await page.waitForFunction(() => {
    const landing = document.querySelector(".ah-landing-in");
    return !!landing && Number(getComputedStyle(landing).opacity) > 0;
  });
  release();
  await expect(
    page.getByRole("navigation", { name: "Työtilat ja keskustelut" }),
  ).toBeVisible();
  const slow = await shownSpan(page);
  expect(slow, "a delayed snapshot shows the landing").toBeDefined();
  expect(slow?.first).toBeGreaterThanOrEqual(300);
  expect(slow?.end, "landing never left").toBeDefined();
  expect((slow?.end ?? 0) - (slow?.first ?? 0)).toBeGreaterThanOrEqual(480);
});

test("@landing says a slow load in words after 8 s and then lands on the home page", async ({
  page,
}) => {
  test.setTimeout(45000);
  await page.request.get("/fixture/scenario?value=ready");
  await login(page);
  let release = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/v1/snapshot", async (route) => {
    await held;
    await route.continue();
  });
  await page.reload();
  const slowLine = page.getByText(
    "Palvelin vastaa tavallista hitaammin. Odotetaan yhä; voit jättää sivun auki.",
  );
  await expect(
    page.getByRole("heading", { name: "Open Habitat" }),
  ).toBeVisible();
  await expect(slowLine).toHaveCount(0);
  await expect(slowLine).toBeVisible({ timeout: 12000 });
  release();
  await expect(
    page.getByRole("navigation", { name: "Työtilat ja keskustelut" }),
  ).toBeVisible();
  await expect(slowLine).toHaveCount(0);
});

test("@landing failure keeps the landing's place and Yritä uudelleen reaches the home page", async ({
  page,
}) => {
  await page.request.get("/fixture/scenario?value=ready");
  await login(page);
  await page.request.get("/fixture/scenario?value=error");
  await page.reload();
  const failure = page.getByRole("heading", {
    name: "Työtiloja ei saatu näkyviin",
  });
  await expect(failure).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Open Habitat" }),
  ).toBeVisible();
  await expect(
    page.getByText("Tämä ei tarkoita, että työtilasi olisivat kadonneet", {
      exact: false,
    }),
  ).toBeVisible();
  // The failure sits where the loading line was: centred in the viewport.
  const box = await page.locator(".ah-landing-in").boundingBox();
  if (!box) throw new Error("landing has no box");
  expect(Math.abs(box.x + box.width / 2 - 640)).toBeLessThan(2);
  await page.request.get("/fixture/scenario?value=ready");
  await page.getByRole("button", { name: "Yritä uudelleen" }).click();
  await expect(
    page.getByRole("navigation", { name: "Työtilat ja keskustelut" }),
  ).toBeVisible();
  await expect(failure).toHaveCount(0);
});
