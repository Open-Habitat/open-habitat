// Synthetic lab only. Start ./scripts/lab.sh start first; fresh Playwright profile.
// PLAYWRIGHT_BROWSERS_PATH="$HOME/.cache/ms-playwright" node issues/design-snappy-conversation-switching/measure-lab.mjs
import { openLab } from '../../web/lab/session.mjs';
const { browser, page } = await openLab();
try {
  await page.getByRole('heading', { name: 'Jatka siitä, mihin jäit', exact: true }).waitFor();
  const routes = await page.locator('.ah-continue-list a[href^="/agents/"]').evaluateAll(
    els => els.slice(0, 2).map(e => e.getAttribute('href')));
  if (routes.length !== 2) throw new Error('lab requires two synthetic read-only histories');
  const results = [];
  for (const path of [...routes, ...routes]) {
    const requests = [];
    const onRequest = r => {
      if (r.url().includes('/api/v1/')) requests.push(new URL(r.url()).pathname);
    };
    page.on('request', onRequest);
    const started = performance.now();
    const history = page.waitForResponse(r => r.url().includes('/history?') &&
      r.url().includes(path.split('/').at(-1)), { timeout: 15000 });
    await page.locator(`a[href="${path}"]`).first().click();
    await history;
    await page.getByRole('heading', { level: 1 }).first().waitFor();
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    results.push({ elapsed_ms: Math.round(performance.now() - started), requests });
    page.off('request', onRequest);
  }
  console.log(JSON.stringify(results, null, 2));
} finally { await browser.close(); }
