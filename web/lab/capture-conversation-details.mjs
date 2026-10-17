import { expect } from "@playwright/test";
import { openLab, origin, snapshot } from "./session.mjs";

const { browser, page } = await openLab();
try {
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "aurinkokello", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Aloita uusi Pi-keskustelu", exact: true })
    .click();
  const route = page.url();
  await page.getByRole("textbox", { name: "Viesti Pi:lle" }).fill("epäonnistu");
  await page.getByRole("button", { name: "Lähetä", exact: true }).click();
  const summary = page.getByRole("button", { name: /PI.*1 epäonnistui/ });
  await summary.waitFor({ timeout: 25000 });
  await summary.click();
  const tool = page.locator(".ah-tool-row").filter({ hasText: "bash" }).first();
  await tool.getByRole("button").first().click();
  for (const width of [1440, 390])
    for (const theme of ["light", "dark"]) {
      await page.setViewportSize({ width, height: 900 });
      await page.evaluate(
        (theme) => (document.documentElement.dataset.theme = theme),
        theme,
      );
      await snapshot(
        page,
        `issues/implement-conversation-details/failed-${width}-${theme}`,
      );
    }

  await page.addStyleTag({
    content: ".ah-feed { min-height: 3000px !important; }",
  });
  const stream = page.locator(".ah-conversation-stream");
  await stream.evaluate((node) => {
    node.dispatchEvent(
      new WheelEvent("wheel", { deltaY: -400, bubbles: true }),
    );
    node.scrollTop = 0;
  });
  await expect(
    page.getByRole("button", { name: "Viimeisimpään", exact: true }),
  ).toBeVisible();
  for (const width of [1440, 390])
    for (const theme of ["light", "dark"]) {
      await page.setViewportSize({ width, height: 900 });
      await page.evaluate(
        (theme) => (document.documentElement.dataset.theme = theme),
        theme,
      );
      await snapshot(
        page,
        `issues/implement-conversation-details/latest-${width}-${theme}`,
      );
    }
  const id = new URL(route).searchParams.get("conversation").slice(3);
  const { csrf } = await (
    await page.request.get(`${origin}/auth/session`)
  ).json();
  const stopped = await page.request.post(
    `${origin}/api/v1/conversations/${id}/stop`,
    { headers: { "X-Agent-Host-CSRF": csrf, Origin: origin } },
  );
  expect(stopped.status()).toBe(200);
  await page.reload();
  const details = page.getByRole("button", { name: "Tiedot", exact: true });
  if ((await details.getAttribute("aria-expanded")) === "false")
    await details.click();
  await page.getByRole("button", { name: "Tarkista keskustelun tila" }).click();
  await expect(
    page.getByRole("button", { name: "Arkistoi", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Arkistoi", exact: true }).click();
  const notice = page.locator(".ah-archive-notice");
  await expect(notice).toBeVisible();
  await expect(
    notice.getByRole("button", { name: "Palauta", exact: true }),
  ).toBeEnabled();
  await notice.getByRole("button", { name: "Palauta", exact: true }).focus();
  for (const width of [1440, 390])
    for (const theme of ["light", "dark"]) {
      await page.setViewportSize({ width, height: 900 });
      await page.evaluate(
        (theme) => (document.documentElement.dataset.theme = theme),
        theme,
      );
      await snapshot(
        page,
        `issues/implement-conversation-details/archive-${width}-${theme}`,
      );
    }
  console.log("Captured", route);
} finally {
  await browser.close();
}
