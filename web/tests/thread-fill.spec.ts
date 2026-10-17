import { hostOrigin } from "../test-ports.mjs";
import { expect, test } from "./worker-host";

test.use({
  baseURL: hostOrigin,
  ignoreHTTPSErrors: true,
  viewport: { width: 1280, height: 720 },
});

// Alhaalta (Jari 16.10.2026): a short conversation sits on the composer and
// grows upwards, while a thread taller than the view still scrolls to its
// first line (an auto top margin, not justify-content: flex-end).
test("@thread-fill a short conversation sits on the composer and a tall thread scrolls to its first line", async ({
  page,
}) => {
  test.setTimeout(60000);
  expect(
    (await page.request.get("/fixture/conversations-reset")).status(),
  ).toBe(204);
  await page.request.get("/fixture/scenario?value=ready");
  expect((await page.request.get("/fixture/history?mode=short")).status()).toBe(
    204,
  );
  await page.goto("/workspaces");
  await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
  await page.getByRole("link", { name: "Alice" }).click();
  const nav = page.getByRole("navigation", { name: "Työtilat ja keskustelut" });
  await nav.getByRole("link", { name: "ordinary-dir" }).click();
  await page.getByRole("button", { name: "Aloita uusi Pi-keskustelu" }).click();
  const stream = page.locator(".ah-conversation-stream");
  // Empty: the invitation is at the bottom, next to the composer.
  const gapBelow = (selector: string) =>
    stream.evaluate((el, s) => {
      const items = el.querySelectorAll(s);
      const last = items[items.length - 1];
      if (!last) return Number.NaN;
      return (
        el.getBoundingClientRect().bottom - last.getBoundingClientRect().bottom
      );
    }, selector);
  await expect(stream.getByText("Aloita keskustelu.")).toBeVisible();
  expect(await gapBelow(".ah-timeline > p")).toBeLessThan(80);
  await page
    .getByRole("textbox", { name: "Viesti Pi:lle" })
    .fill("ensimmäinen");
  await page.getByRole("button", { name: "Lähetä", exact: true }).click();
  await expect(stream.getByText('Selvä. Kysyit: "ensimmäinen".')).toBeVisible({
    timeout: 20000,
  });
  expect(await gapBelow(".ah-feed > li")).toBeLessThan(80);
  const freeAbove = await stream.evaluate(
    (el) =>
      (el.querySelector(".ah-feed > li")?.getBoundingClientRect().top ?? 0) -
      el.getBoundingClientRect().top,
  );
  expect(freeAbove).toBeGreaterThan(150);

  // Tall: the native page is taller than the view; its first child is
  // reachable at the top of the scroll range.
  await nav.getByRole("link", { name: /Synteettinen viesti 0/ }).click();
  await expect(page.locator(".ah-feed li")).toHaveCount(25);
  const top = await stream.evaluate((el) => {
    el.scrollTop = 0;
    const first = el.firstElementChild?.getBoundingClientRect().top ?? 0;
    return {
      offset: first - el.getBoundingClientRect().top,
      tall: el.scrollHeight > el.clientHeight * 1.5,
    };
  });
  expect(top.tall).toBe(true);
  expect(top.offset).toBeGreaterThanOrEqual(0);
  await expect(
    page.getByRole("button", { name: "Lataa vanhempi historiasivu" }),
  ).toBeInViewport();
});
