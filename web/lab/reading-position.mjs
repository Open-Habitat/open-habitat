// Run against a fresh synthetic lab: OH_PORT_BASE=<free base> ./scripts/lab.sh start
// PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright node web/lab/reading-position.mjs
import { expect } from "@playwright/test";
import { openLab } from "./session.mjs";

const { browser, page } = await openLab();
try {
  await page.getByText("aurinkokello", { exact: true }).first().click();
  await page.getByRole("button", { name: "Aloita uusi Pi-keskustelu" }).click();
  const conversationURL = new URL(page.url());
  const editor = page.getByRole("textbox", { name: "Viesti Pi:lle" });
  for (let n = 1; n <= 34; n++) {
    await editor.fill(`pitkä historia ${n}`);
    const send = page.getByRole("button", { name: "Lähetä", exact: true });
    await expect(send).toBeEnabled({ timeout: 30000 });
    await send.click();
    await expect(
      page
        .locator(".ah-feed > li")
        .filter({ hasText: `Selvä. Kysyit: "pitkä historia ${n}"` })
        .last(),
    ).toBeVisible({ timeout: 30000 });
  }
  await page.reload(); // cold load establishes the initial tail window
  const reply = (n) =>
    page
      .locator(".ah-feed > li")
      .filter({ hasText: `Selvä. Kysyit: "pitkä historia ${n}"` })
      .last();
  let pages = 0;
  while (!(await reply(1).count())) {
    const count = await page.locator(".ah-feed > li").count();
    await page
      .getByRole("button", { name: "Lataa vanhempi historiasivu" })
      .click();
    await expect
      .poll(() => page.locator(".ah-feed > li").count())
      .toBeGreaterThan(count);
    pages++;
  }
  if (!pages) throw new Error("backward paging did not occur");
  const results = [];
  for (const { name, number, offset } of [
    { name: "top", number: 1, offset: 0 },
    { name: "middle", number: 12, offset: 42 },
  ]) {
    const row = reply(number);
    await row.evaluate((element, offset) => {
      const feed = element.closest(".ah-conversation-stream");
      feed.scrollTop +=
        element.getBoundingClientRect().top -
        feed.getBoundingClientRect().top +
        offset;
    }, offset);
    const measure = () =>
      row.evaluate((element) => ({
        text: element.textContent.match(
          /Selvä\. Kysyit: "pitkä historia \d+"/,
        )?.[0],
        top:
          element.getBoundingClientRect().top -
          element.closest(".ah-conversation-stream").getBoundingClientRect()
            .top,
      }));
    const before = await measure();
    let requests = 0;
    const watch = (request) => {
      if (new URL(request.url()).pathname.startsWith("/api/v1/")) requests++;
    };
    page.on("request", watch);
    const started = Date.now();
    await page.getByRole("link", { name: "Etusivu", exact: true }).click();
    await page
      .locator(`a[href="${conversationURL.pathname}${conversationURL.search}"]`)
      .first()
      .click();
    await expect(row).toBeVisible();
    await page.evaluate(
      () =>
        new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        ),
    );
    const after = await measure();
    page.off("request", watch);
    const result = {
      name,
      before,
      after,
      requests,
      clickToPaintMs: Date.now() - started,
      missedEventsBanner: await page.getByText("Tapahtumia jäi väliin").count(),
    };
    results.push(result);
    if (
      before.text !== after.text ||
      Math.abs(before.top - after.top) > 2 ||
      requests ||
      result.missedEventsBanner
    )
      throw new Error(`warm return failed: ${JSON.stringify(result)}`);
  }
  console.log(JSON.stringify({ sends: 34, olderPages: pages, results }));
} finally {
  await browser.close();
}
