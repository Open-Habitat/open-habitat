// Paired lab captures for server-name-inline-edit. Run from the repository
// root against a running synthetic lab (scripts/lab.sh start). Restores the
// lab's server name at the end.
import { openLab, snapshot } from '../../web/lab/session.mjs';
import { expect } from '../../web/node_modules/@playwright/test/index.mjs';
for (const narrow of [false, true]) for (const dark of [false, true]) {
  const tag = `${narrow ? 'phone' : 'desktop'}-${dark ? 'dark' : 'light'}`;
  const { page, browser } = await openLab({ width: narrow ? 390 : 1440, height: narrow ? 844 : 900 });
  if (dark) await page.emulateMedia({ colorScheme: 'dark' });
  const shot = (name) => snapshot(page, `issues/server-name-inline-edit/lab-${tag}-${name}`);
  await page.goto(new URL('/settings', page.url()).href);
  await page.getByRole('button', { name: 'Palvelin', exact: true }).click();
  const field = page.getByLabel('Palvelimen nimi', { exact: true });
  const original = await field.inputValue();
  await field.fill('Synteettinen labra');
  await field.press('Enter');
  await expect(page.getByText('Tallennettu', { exact: true })).toBeVisible();
  await shot('saved');
  await page.route('**/api/v1/server/administration', (route) => route.request().method() === 'PUT' ? route.fulfill({ status: 503 }) : route.continue());
  await field.fill('Ei tallennu');
  await field.blur();
  await expect(page.getByText(/Ei tallennettu/)).toBeVisible();
  await shot('failed');
  await page.unroute('**/api/v1/server/administration');
  await field.fill(original);
  await field.press('Enter');
  await expect(page.getByText('Tallennettu', { exact: true })).toBeVisible();
  if (narrow) await page.getByRole('button', { name: '← Asetukset' }).click();
  await page.getByRole('button', { name: 'Levytila', exact: true }).click();
  await expect(page.getByLabel('Oletusraja', { exact: true })).toBeVisible();
  await shot('storage');
  await browser.close();
}
