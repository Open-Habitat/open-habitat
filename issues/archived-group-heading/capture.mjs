// Paired lab captures for archived-group-heading (after; the before images are archive-workspace-restore's). Run from the repository
// root against a running synthetic lab (scripts/lab.sh start).
import { openLab, snapshot } from '../../web/lab/session.mjs';
import { expect } from '../../web/node_modules/@playwright/test/index.mjs';
for (const narrow of [false, true]) for (const dark of [false, true]) {
  const tag = `${narrow ? 'phone' : 'desktop'}-${dark ? 'dark' : 'light'}`;
  const { page, browser } = await openLab({ width: narrow ? 390 : 1440, height: narrow ? 844 : 900 });
  if (dark) await page.emulateMedia({ colorScheme: 'dark' });
  const shot = (name) => snapshot(page, `issues/archived-group-heading/lab-after-${tag}-${name}`);
  const nav = async () => { if (narrow) await page.getByRole('button', { name: 'Avaa navigaatio' }).click(); };
  await nav();
  await page.locator('.ah-workspace').getByRole('link', { name: 'muistiinpanot', exact: true }).click();
  await page.getByRole('button', { name: 'Arkistoi työtila' }).click();
  await expect(page.getByText('Tiedostot ja keskustelut säilyvät', { exact: false }).first()).toBeVisible();
  // (the archive notice belongs to archive-workspace-restore)
  await page.goto(new URL('/workspaces', page.url()).href);
  await nav();
  await shot('archived-collapsed');
  await page.getByRole('button', { name: 'Arkistoidut', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Palauta muistiinpanot' })).toBeVisible();
  await shot('archived-group');
  await page.getByRole('button', { name: 'Palauta muistiinpanot' }).click();
  await expect(page.locator('.ah-workspace').getByRole('link', { name: 'muistiinpanot', exact: true })).toBeVisible();
  await browser.close();
}
