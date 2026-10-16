// Synthetic lab only: node issues/server-version-reload/capture.mjs from the
// repository root against a running scripts/lab.sh. Each upgrade restarts the
// lab gateway under the next 0.0.0-lab.N version with a re-referenced bundle.
import { openLab, origin, snapshot } from '../../web/lab/session.mjs';
import { expect } from '../../web/node_modules/@playwright/test/index.mjs';
const out = name => 'issues/server-version-reload/lab-' + name;
const visible = page => page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
for (const [vp, width, height] of [['desktop', 1440, 1000], ['phone', 390, 844]])
  for (const scheme of ['light', 'dark']) {
    const tag = `${vp}-${scheme}`;
    const { page, browser } = await openLab({ width, height });
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto(`${origin}/settings`);
    await page.getByRole('button', { name: 'Palvelin', exact: true }).click();
    const row = page.locator('.s-row').filter({ hasText: 'Versio' });
    await expect(row.getByText('Tämä välilehti on ajan tasalla.')).toBeVisible();
    await snapshot(page, out(`palvelin-${tag}`));
    // This tab now holds an older bundle than the server serves.
    await page.request.get(`${origin}/fixture/upgrade`);
    await visible(page);
    await expect(row.getByText('Tämä välilehti käyttää vanhempaa versiota.')).toBeVisible();
    await page.getByRole('button', { name: 'Myöhemmin' }).click();
    await snapshot(page, out(`palvelin-stale-${tag}`));
    await page.reload();
    await page.goto(`${origin}/workspaces`);
    await page.getByRole('link', { name: 'kotisivu', exact: true }).first().click();
    await page.getByRole('button', { name: 'Aloita uusi Pi-keskustelu' }).click();
    // Upgrade only after creation settled; a restart mid-creation is another state.
    await expect(page.locator('.ah-agent-header [aria-label*="Odottaa"], .ah-agent-header :text("Odottaa")').first()).toBeAttached({ timeout: 20000 });
    await page.getByRole('textbox', { name: 'Viesti Pi:lle' }).fill('Puolivalmis luonnos');
    await page.request.get(`${origin}/fixture/upgrade`);
    await visible(page);
    await expect(page.getByText('Uusi versio on saatavilla')).toBeVisible();
    // The restart briefly drops the event stream; capture after it recovers.
    await expect(page.getByText(/Yhteys katkesi/)).toHaveCount(0, { timeout: 30000 });
    await snapshot(page, out(`banner-${tag}`));
    await browser.close();
  }
