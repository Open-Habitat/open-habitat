// Paired lab captures for recap-no-waiting-label: an answered conversation
// (waiting for the person) with its automatic recap. Run from the repository
// root against a running synthetic lab (scripts/lab.sh start).
import { openLab, snapshot, origin } from '../../web/lab/session.mjs';
import { expect } from '../../web/node_modules/@playwright/test/index.mjs';
for (const narrow of [false, true]) for (const dark of [false, true]) {
  const tag = `${narrow ? 'phone' : 'desktop'}-${dark ? 'dark' : 'light'}`;
  const { page, browser } = await openLab({ width: narrow ? 390 : 1440, height: narrow ? 844 : 900 });
  await page.request.get(`${origin}/fixture/scenario?value=pi-recap`);
  try {
    if (dark) await page.emulateMedia({ colorScheme: 'dark' });
    if (narrow) await page.getByRole('button', { name: 'Avaa navigaatio' }).click();
    await page.getByRole('navigation').getByRole('link', { name: 'aurinkokello' }).click();
    await page.getByRole('button', { name: 'Aloita uusi Pi-keskustelu' }).click();
    await page.getByRole('textbox', { name: 'Viesti Pi:lle' }).fill('Tutki synteettinen työtila');
    await page.getByRole('button', { name: 'Lähetä', exact: true }).click();
    const card = page.getByRole('complementary', { name: 'Keskustelun yhteenveto' });
    await expect(card.getByText('luotu automaattisesti')).toBeVisible({ timeout: 30000 });
    await card.scrollIntoViewIfNeeded();
    await snapshot(page, `issues/recap-no-waiting-label/lab-${tag}-recap`);
  } finally {
    await page.request.get(`${origin}/fixture/scenario?value=ready`);
    await browser.close();
  }
}
