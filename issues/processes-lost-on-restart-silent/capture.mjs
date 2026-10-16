// Synthetic lab, real flow: the fake Pi leaves a native process start in its
// branch, the lab daemon restarts, and the tray reads the cut-off process.
// Run from the repository root with `scripts/lab.sh start` running.
import { openLab, origin } from '../../web/lab/session.mjs';
const dir = 'issues/processes-lost-on-restart-silent';
const { browser, page } = await openLab({ width: 1440, height: 1000 });
try {
  await page.request.get(`${origin}/fixture/lab-conversations-clean`);
  await page.request.get(`${origin}/fixture/scenario?value=ready`);
  await page.getByRole('navigation').getByRole('link', { name: 'aurinkokello' }).click();
  await page.getByRole('button', { name: 'Aloita uusi Pi-keskustelu' }).click();
  const editor = page.getByRole('textbox', { name: 'Viesti Pi:lle' });
  await editor.fill('käynnistä taustaprosessi');
  await page.getByRole('button', { name: 'Lähetä', exact: true }).click();
  await page.getByText('Selvä. Kysyit: "käynnistä taustaprosessi".').waitFor({ timeout: 20000 });
  await page.request.get(`${origin}/fixture/daemon-restart`);
  for (const width of [1440, 390]) for (const theme of ['light', 'dark']) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    await page.reload();
    await page.evaluate(t => { document.documentElement.dataset.theme = t; localStorage.setItem('nah:theme', t); }, theme);
    await editor.waitFor();
    const tray = page.getByRole('complementary', { name: 'Agentin prosessit' });
    await tray.getByRole('button', { name: /Prosessit · 1 katkesi/ }).click();
    await tray.getByText('kehityspalvelin').waitFor();
    await page.evaluate(async () => { await document.fonts.ready; });
    await page.screenshot({ path: `${dir}/${width === 390 ? 'phone' : 'desktop'}-${theme}-interrupted.png` });
  }
} finally { await browser.close(); }
