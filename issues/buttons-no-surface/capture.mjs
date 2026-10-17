// Paired before/after lab captures for buttons-no-surface: every settings
// section and the workspace screens, desktop and phone, light and dark.
// Run from the repository root against a running synthetic lab
// (scripts/lab.sh start): node issues/buttons-no-surface/capture.mjs before|after
import { openLab, snapshot } from '../../web/lab/session.mjs';
import { expect } from '../../web/node_modules/@playwright/test/index.mjs';
const stage = process.argv[2];
if (!['before', 'after'].includes(stage)) throw new Error('usage: capture.mjs before|after');
const dir = 'issues/buttons-no-surface';
const sections = ['Tili', 'Agentit', 'Yhteydet', 'Ulkoasu', 'Tallennustila', 'Palvelin', 'Käyttäjät', 'Levytila'];
const slug = (s) => s.toLowerCase().replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/[^a-z0-9]+/g, '-');
for (const narrow of [false, true]) for (const dark of [false, true]) {
  const tag = `${narrow ? 'phone' : 'desktop'}-${dark ? 'dark' : 'light'}`;
  const { page, browser } = await openLab({ width: narrow ? 390 : 1440, height: narrow ? 844 : 900 });
  if (dark) await page.emulateMedia({ colorScheme: 'dark' });
  const shot = (name) => snapshot(page, `${dir}/${stage}-${tag}-${name}`, { html: stage === 'after' });
  const origin = new URL(page.url()).origin;
  await expect(page.getByRole('heading', { name: 'Työtilat', exact: true })).toBeVisible();
  await shot('home');
  // A workspace page: its Git and default-agent text buttons.
  await page.goto(`${origin}/workspaces`);
  if (narrow) await page.getByRole('button', { name: 'Avaa navigaatio' }).click();
  await page.locator('.ah-workspace').getByRole('link', { name: 'muistiinpanot', exact: true }).click();
  await expect(page.locator('main h1')).toBeVisible();
  await shot('workspace');
  // A Git workspace and one of its conversations: Git, recap and composer controls.
  await page.goto(`${origin}/workspaces`);
  if (narrow) await page.getByRole('button', { name: 'Avaa navigaatio' }).click();
  await page.locator('.ah-workspace').getByRole('link', { name: 'aurinkokello', exact: true }).click();
  await expect(page.locator('main h1')).toBeVisible();
  await page.waitForTimeout(300);
  await shot('workspace-git');
  if (narrow) await page.getByRole('button', { name: 'Avaa navigaatio' }).click();
  await page.locator('.ah-workspace').getByRole('link', { name: /Miksi CI/ }).first().click();
  await page.locator('.ah-conversation-frame').waitFor();
  await page.waitForTimeout(500);
  await shot('conversation');
  for (const section of sections) {
    await page.goto(`${origin}/settings`);
    await page.locator('.s-nav').waitFor();
    // The administration sections appear once the server role is read.
    await page.locator('.s-nav-h').waitFor({ timeout: 5000 }).catch(() => {});
    const item = page.locator('.s-nav').getByRole('button', { name: section, exact: true });
    if (!(await item.count())) { console.log(`${tag}: no ${section}`); continue; }
    await item.click();
    await page.waitForTimeout(300);
    await shot(`settings-${slug(section)}`);
  }
  await browser.close();
}
