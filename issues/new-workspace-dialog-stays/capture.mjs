// Paired lab captures for new-workspace-dialog-stays. Run from the repository
// root against a running synthetic lab (scripts/lab.sh start). The clone stream
// is replaced in the page so that one progress frame stays on screen; the
// release then ends it rejected, which the dialog shows as a failure.
import { openLab, snapshot } from '../../web/lab/session.mjs';
import { expect } from '../../web/node_modules/@playwright/test/index.mjs';
const fake = () => {
  const real = window.fetch;
  window.fetch = (input, init) => {
    if (String(input).endsWith('/api/v1/onboarding/github/clone/stream')) {
      const enc = new TextEncoder();
      const body = new ReadableStream({
        async start(c) {
          c.enqueue(enc.encode('event: progress\ndata: {"schema_version":1,"sequence":1,"kind":"progress","stage":"receiving","percent":42,"received_bytes":1048576}\n\n'));
          await new Promise((r) => { window.__releaseClone = r; });
          c.enqueue(enc.encode('event: terminal\ndata: {"schema_version":1,"sequence":2,"kind":"terminal","outcome":"rejected"}\n\n'));
          c.close();
        },
      });
      return Promise.resolve(new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream; charset=utf-8' } }));
    }
    return real(input, init);
  };
};
for (const narrow of [false, true]) for (const dark of [false, true]) {
  const tag = `${narrow ? 'phone' : 'desktop'}-${dark ? 'dark' : 'light'}`;
  const { page, browser } = await openLab({ width: narrow ? 390 : 1440, height: narrow ? 844 : 900 });
  if (dark) await page.emulateMedia({ colorScheme: 'dark' });
  await page.evaluate(fake);
  const shot = (name) => snapshot(page, `issues/new-workspace-dialog-stays/lab-${tag}-${name}`);
  await page.locator('main').getByRole('button', { name: 'Uusi työtila' }).click();
  const dialog = page.getByRole('dialog', { name: 'Uusi työtila' });
  await dialog.getByRole('textbox', { name: 'Repositorio' }).fill('fixture/last');
  await dialog.getByRole('button', { name: 'Luo työtila' }).click();
  await expect(dialog.getByRole('status')).toContainText('42 %');
  await shot('progress');
  await page.evaluate(() => window.__releaseClone());
  await expect(dialog.getByRole('alert')).toBeVisible();
  await shot('failed');
  await browser.close();
}
