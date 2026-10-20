import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { hostOrigin } from "../test-ports.mjs";
import { expect, test } from "./worker-host";

test.use({ baseURL: hostOrigin, ignoreHTTPSErrors: true });

async function openConversation(page: Page) {
  await page.request.get("/fixture/scenario?value=ready");
  await page.goto("/workspaces");
  await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
  await page.getByRole("link", { name: "Alice", exact: true }).click();
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "ordinary-dir", exact: true })
    .click();
  await page.getByRole("button", { name: "Aloita uusi Pi-keskustelu" }).click();
  await page
    .getByRole("textbox", { name: "Viesti Pi:lle" })
    .fill("Check the synthetic workspace");
  await page.getByRole("button", { name: "Lähetä", exact: true }).click();
  await expect(
    page.getByText('Selvä. Kysyit: "Check the synthetic workspace".', {
      exact: false,
    }),
  ).toBeVisible({ timeout: 20000 });
}

test("title regeneration after daemon restart uses native history without continuing Pi", async ({
  page,
}) => {
  await openConversation(page);
  const url = page.url();
  const agent = new URL(url).searchParams.get("conversation");
  if (!agent?.startsWith("pi:")) throw new Error("Missing conversation ID");
  const id = agent.slice(3);
  expect((await page.request.get("/fixture/daemon-restart")).status()).toBe(
    204,
  );
  await page.goto(url);
  const retitle = page.getByRole("button", { name: "Luo uusi otsikko" });
  await expect(retitle).toBeEnabled();
  const response = page.waitForResponse((reply) =>
    /\/(regenerate_title|history_title)$/.test(reply.url()),
  );
  await retitle.click();
  const reply = await response;
  expect(reply.status()).toBe(200);
  expect(await reply.json()).toMatchObject({ state: "done" });
  await expect(
    page.getByRole("heading", { name: "Synteettinen otsikko", exact: true }),
  ).toBeVisible();
  // Naming a stopped history must not leave a controllable Pi running.
  expect(
    (
      await (
        await page.request.get(`/api/v1/conversations/${id}/status`)
      ).json()
    ).state,
  ).toBe("stopped");
});

test("pending live title arrow rotates in place; failures use the conversation notice area @a11y", async ({
  page,
}) => {
  await openConversation(page);
  const retitle = page.getByRole("button", { name: "Luo uusi otsikko" });
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/regenerate_title", async (route) => {
    await held;
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: '{"schema_version":1,"error":{"code":"native_source_unavailable"}}',
    });
  });
  try {
    await retitle.click();
    await expect(retitle).toBeDisabled();
    // Freeze the real animation at several angles. Its centre must remain fixed,
    // even though its parent SVG places/scales the small refresh arrow.
    const centres = await retitle
      .locator(".ah-retitle-spin")
      .evaluate((element) => {
        const animation = element.getAnimations()[0];
        animation.pause();
        return [0, 225, 450, 675].map((time) => {
          animation.currentTime = time;
          const box = element.getBoundingClientRect();
          return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
        });
      });
    for (const centre of centres) {
      expect(Math.abs(centre.x - centres[0].x)).toBeLessThan(1);
      expect(Math.abs(centre.y - centres[0].y)).toBeLessThan(1);
    }
  } finally {
    release();
  }
  const notice = page
    .locator(".ah-conversation-notices")
    .getByText("Otsikkoa ei voitu luoda");
  await expect(notice).toBeVisible();
  await expect(
    page.locator(".ah-agent-header").getByText("Otsikkoa ei voitu luoda"),
  ).toHaveCount(0);
  await expect(retitle).toBeEnabled();
  const a11y = await new AxeBuilder({ page })
    .include(".ah-conversation-notices")
    .analyze();
  expect(a11y.violations).toEqual([]);
  await page.unroute("**/regenerate_title");
  // A real live RPC title request still uses the live operation. The fake Pi
  // lacks a model runtime, so its fixed failure must retain the existing title.
  const response = page.waitForResponse((reply) =>
    reply.url().endsWith("/regenerate_title"),
  );
  await retitle.click();
  expect(await (await response).json()).toMatchObject({
    state: "failed",
    reason: "model_unavailable",
  });
  await expect(notice).toBeVisible();
  await expect(retitle).toBeEnabled();
  await expect(
    page.getByRole("heading", {
      name: "Check the synthetic workspace",
      exact: true,
    }),
  ).toBeVisible();
});

test("@a11y compact header gives the title a row on phones and keeps model facts read-only", async ({
  page,
}) => {
  await openConversation(page);
  const header = page.locator(".ah-agent-header");
  await header.locator("h1").evaluate((el) => {
    el.textContent =
      "Pitkä keskustelun otsikko jonka pitäisi saada tilaa työkalujen rinnalla";
  });
  for (const theme of ["light", "dark"]) {
    await page.evaluate(
      (value) => document.documentElement.setAttribute("data-theme", value),
      theme,
    );
    for (const width of [1366, 390]) {
      await page.setViewportSize({ width, height: 844 });
      const title = await header.locator("h1").boundingBox();
      expect(title?.width).toBeGreaterThan(width === 390 ? 300 : 200);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      const pill = header.locator(".md-chip-picker > summary");
      await pill.click();
      const info = header.getByRole("region", {
        name: "Keskustelun malli ja ajattelutaso",
      });
      await expect(info).toBeVisible();
      await expect(info.locator("button, input, select")).toHaveCount(0);
      const box = await info.boundingBox();
      expect(box?.x).toBeGreaterThanOrEqual(0);
      expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(width);
      expect(
        (await new AxeBuilder({ page }).include(".ah-agent-header").analyze())
          .violations,
      ).toEqual([]);
      await page.keyboard.press("Escape");
      await expect(pill).toBeFocused();
    }
  }
});
