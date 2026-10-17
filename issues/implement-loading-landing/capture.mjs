// Paired lab captures for implement-loading-landing. Run from the repository
// root against a running synthetic lab (scripts/lab.sh start). The loads are
// shaped in this browser only: the bundle or the snapshot is held or refused.
import { openLab, snapshot } from '../../web/lab/session.mjs';
import { expect } from '../../web/node_modules/@playwright/test/index.mjs';
const dir = 'issues/implement-loading-landing';
for (const narrow of [false, true]) for (const dark of [false, true]) {
  const tag = `${narrow ? 'phone' : 'desktop'}-${dark ? 'dark' : 'light'}`;
  const { page, browser } = await openLab({ width: narrow ? 390 : 1440, height: narrow ? 844 : 900 });
  if (dark) await page.emulateMedia({ colorScheme: 'dark' });
  const shot = (name) => snapshot(page, `${dir}/lab-${tag}-${name}`);
  const home = () => expect(page.getByRole('heading', { name: 'Työtilat', exact: true })).toBeVisible();
  await home();
  // Before the bundle: index.html's static landing, after its 300 ms delay.
  let releaseBundle = () => {};
  const bundle = new Promise((r) => { releaseBundle = r; });
  await page.route('**/assets/index-*.js', async (route) => { await bundle; await route.continue().catch(() => {}); });
  await page.reload({ waitUntil: 'commit' });
  await page.waitForTimeout(700);
  // A screenshot only: the HTML twin would fetch the held bundle.
  await page.screenshot({ path: `${dir}/lab-${tag}-before-bundle.png`, fullPage: true });
  releaseBundle();
  await home();
  await page.unroute('**/assets/index-*.js');
  // Slow: the snapshot is held; first the greeting, then the slow line at 8 s.
  let release = () => {};
  const held = new Promise((r) => { release = r; });
  await page.route('**/api/v1/snapshot', async (route) => { await held; await route.continue().catch(() => {}); });
  await page.reload();
  await expect(page.getByRole('status')).toHaveText('Hei Alice. Haetaan työtilojasi…');
  await page.waitForTimeout(400);
  await shot('loading');
  await expect(page.getByText('Palvelin vastaa tavallista hitaammin', { exact: false })).toBeVisible({ timeout: 12000 });
  await shot('slow');
  release();
  await home();
  await page.unroute('**/api/v1/snapshot');
  // Failed: the snapshot answers 503; the failure keeps the landing's place.
  await page.route('**/api/v1/snapshot', (route) => route.fulfill({ status: 503, body: 'unavailable' }));
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Työtiloja ei saatu näkyviin' })).toBeVisible();
  await page.waitForTimeout(400);
  await shot('failed');
  await page.unroute('**/api/v1/snapshot');
  await page.getByRole('button', { name: 'Yritä uudelleen' }).click();
  await home();
  // Fast: an ordinary local load paints the home page without a landing.
  await page.reload();
  await home();
  await shot('fast-home');
  await browser.close();
}
