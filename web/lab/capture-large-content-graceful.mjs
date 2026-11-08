// Synthetic lab only: evidence for issues/large-content-graceful, the moments
// of direction C at 1440 and 390, Finnish and English, device scale 2. Start
// the lab first (scripts/lab.sh start), then from the repository root:
//   PLAYWRIGHT_BROWSERS_PATH=... node web/lab/capture-large-content-graceful.mjs
// The heavy conversation is one browser conversation grown with invented
// picture data to 400 MiB and then 530 MiB (the /fixture/heavy seam).
import { chromium } from "@playwright/test";
import { origin, snapshot } from "./session.mjs";

const out = new URL(
  "../../issues/large-content-graceful/evidence/",
  import.meta.url,
).pathname;
const browser = await chromium.launch({ headless: true });
const languages = ["fi", "en-US"];

async function open(width) {
  const phone = width <= 800;
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    viewport: { width, height: phone ? 844 : 900 },
    deviceScaleFactor: 2,
    isMobile: phone,
    hasTouch: phone,
    locale: "fi-FI",
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  await page.goto(`${origin}/workspaces`);
  await page.getByTestId("github-sign-in").click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
  await page.waitForURL(/\/workspaces/);
  return { context, page, phone };
}

async function preference(page, data) {
  const session = await (
    await page.request.get(`${origin}/auth/session`)
  ).json();
  await page.request.put(`${origin}/api/v1/account/preferences`, {
    headers: { Origin: origin, "X-Agent-Host-CSRF": session.csrf },
    data,
  });
}

async function startConversation(page) {
  const state = await (
    await page.request.get(`${origin}/api/v1/snapshot`)
  ).json();
  const ws = state.workspaces.find(
    (w) => w.name === "aurinkokello",
  ).workspace_id;
  await page.goto(`${origin}/workspaces/${ws}`);
  await page.getByTestId("conversation-start").first().click();
  await page.getByTestId("start-here").waitFor();
  await page.getByTestId("message-input").fill("Katso testipalvelimen kuvat.");
  await page
    .getByTestId("send")
    .and(page.locator('[data-mode="send"]'))
    .click();
  await page.waitForURL(/conversation=pi:/);
  await page.getByTestId("history-stage-toggle").last().waitFor({
    timeout: 20000,
  });
  return page.url();
}

const shot = (page, name) => snapshot(page, `${out}${name}`);
const settle = (page) => page.waitForTimeout(900);

// ③ Too much for one message: six 17 MiB files, refused at Send.
async function overflow(page, url, tag) {
  await page.goto(url);
  await settle(page);
  const input = page.locator('.ah-composer input[type="file"]');
  await page.getByTestId("message-input").fill("Ja nämä ovat toisesta ajosta.");
  await input.evaluate((element) => {
    const data = new DataTransfer();
    for (let i = 0; i < 6; i++)
      data.items.add(
        new File([new Uint8Array(17 * 1024 * 1024)], `step-${i + 1}.png`),
      );
    element.files = data.files;
    element.dispatchEvent(new Event("change", { bubbles: true }));
  });
  const chips = page.locator(".ah-composer").getByTestId("attachment-chip");
  await chips.nth(5).waitFor();
  await page
    .getByTestId("send")
    .and(page.locator('[data-mode="send"]'))
    .click();
  await page.getByTestId("attachment-overflow").waitFor();
  await settle(page);
  await shot(page, `03-liikaa-liitteita-${tag}`);
  // The draft is the person's; clear it for the next moment.
  while ((await chips.count()) > 0)
    await chips.first().getByTestId("attachment-remove").click();
  await page.getByTestId("message-input").fill("");
}

async function weight(page, url, name, tag) {
  await page.goto(url);
  await page.getByTestId("conversation-weight").waitFor({ timeout: 30000 });
  await settle(page);
  await shot(page, `${name}-${tag}`);
}

const contexts = [];
for (const width of [1440, 390])
  contexts.push({ width, ...(await open(width)) });
const url = await startConversation(contexts[0].page);
const id = /conversation=pi(?::|%3A)([0-9a-f-]{36})/.exec(url)?.[1];
async function grow(mib) {
  const reply = await contexts[0].page.request.get(
    `${origin}/fixture/heavy?id=${id}&mib=${mib}`,
    { timeout: 120000 },
  );
  if (reply.status() !== 204)
    throw new Error(`heavy fixture ${reply.status()} for ${url}`);
}

for (const { width, page } of contexts)
  for (const language of languages) {
    await preference(page, { language });
    await overflow(page, url, `${language}-${width}`);
  }

await grow(400);
for (const { width, page } of contexts)
  for (const language of languages) {
    await preference(page, { language });
    await weight(page, url, "04-lahestyy-rajaa", `${language}-${width}`);
  }

await grow(530);
for (const { width, page, phone } of contexts)
  for (const language of languages) {
    await preference(page, { language });
    const tag = `${language}-${width}`;
    await weight(page, url, "05-liian-suuri", tag);
    // ① The folded pictures of one huge entry, and the rest of history.
    // The screenshot turn's work and its tool open to show the pictures.
    await page.getByTestId("history-stage-toggle").last().click();
    await page.waitForTimeout(300);
    await page.getByTestId("history-tool-toggle").last().click();
    const folded = page.getByTestId("history-pictures-folded").last();
    await folded.scrollIntoViewIfNeeded();
    await settle(page);
    await shot(page, `01-kuvat-koottuina-${tag}`);
    if (language === "fi" && !phone) {
      // The explain card of the new controls.
      await preference(page, { experimental: { "explain-mode": true } });
      await page.reload();
      await page.getByTestId("conversation-weight").waitFor();
      await page.getByTestId("history-stage-toggle").last().click();
      await page.waitForTimeout(300);
      await page.getByTestId("history-tool-toggle").last().click();
      await page.getByTestId("history-pictures-folded").last().waitFor();
      await page.getByTestId("explain-toggle").click();
      for (const [testId, name] of [
        ["conversation-weight-new", "06-selitys-uusi-keskustelu"],
        ["history-pictures-open", "07-selitys-avaa-kuvat"],
      ]) {
        const target = page.getByTestId(testId).last();
        await target.scrollIntoViewIfNeeded();
        const box = await target.boundingBox();
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.waitForTimeout(500);
        await shot(page, `${name}-${tag}`);
      }
      await page.keyboard.press("Escape");
      await preference(page, { experimental: { "explain-mode": false } });
    }
  }

await contexts[0].page.request.get(`${origin}/fixture/conversations-reset`);
await browser.close();
