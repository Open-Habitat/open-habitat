import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('long history stays bounded, keyboard reachable, and stream preserves focus', async ({ page }) => {
  await page.goto('/servers/alder/workspaces/redacted/agents/pi-redacted');
  await expect(page.getByRole('heading', { name: 'Pi-keskustelun renderöintikoe' })).toBeVisible();
  const mountedEvents = await page.locator('.event').count();
  expect(mountedEvents).toBeGreaterThan(0);
  expect(mountedEvents).toBeLessThan(50);

  const draft = page.getByLabel('Luonnos');
  await draft.fill('välilehtikohtainen luonnos');
  await page.reload();
  await expect(draft).toHaveValue('välilehtikohtainen luonnos');
  await page.evaluate(() => {
    history.pushState({}, '', '/servers/alder/workspaces/redacted/agents/pi-second');
    dispatchEvent(new PopStateEvent('popstate'));
  });
  await expect(draft).toHaveValue('');
  await draft.fill('toisen agentin luonnos');
  await page.evaluate(() => {
    history.pushState({}, '', '/servers/alder/workspaces/redacted/agents/pi-redacted');
    dispatchEvent(new PopStateEvent('popstate'));
  });
  await expect(draft).toHaveValue('välilehtikohtainen luonnos');

  const stream = page.getByRole('button', { name: 'Lisää stream-tapahtuma' });
  await stream.focus();
  await stream.press('Enter');
  await expect(stream).toBeFocused();
  await expect(page.getByText('2501 tapahtumaa.')).toBeVisible();

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});

test('route is the selected agent owner and unsafe markup stays inert', async ({ page }) => {
  await page.goto('/servers/alder/workspaces/redacted/agents/pi-redacted');
  await expect(page).toHaveURL(/agents\/pi-redacted$/);
  const visibleText = await page.locator('body').innerText();
  expect(visibleText).not.toContain("alert('x')");
  await page.getByRole('button', { name: 'Simuloi epävarma lähetys' }).click();
  await expect(page.getByText(/Komento: uncertain/)).toBeVisible();
});
