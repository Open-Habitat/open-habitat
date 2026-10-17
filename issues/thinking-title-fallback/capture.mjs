// Paired lab captures for thinking-title-fallback: one OpenAI-shaped (titled)
// and two Claude-shaped (untitled) reasoning blocks, injected through the
// validated history boundary of a lab conversation. Run from the repository
// root against a running synthetic lab (scripts/lab.sh start).
import { openLab, snapshot, origin } from '../../web/lab/session.mjs';
import { expect } from '../../web/node_modules/@playwright/test/index.mjs';
const content = (text) => ({ media_type: 'text/plain', text, complete: true });
for (const narrow of [false, true]) for (const dark of [false, true]) {
  const tag = `${narrow ? 'phone' : 'desktop'}-${dark ? 'dark' : 'light'}`;
  const { page, browser } = await openLab({ width: narrow ? 390 : 1440, height: narrow ? 844 : 900 });
  if (dark) await page.emulateMedia({ colorScheme: 'dark' });
  await page.route('**/api/v1/agents/*/history?*', async (route) => {
    const response = await route.fetch();
    const json = await response.json();
    if (!json.entries) return route.fulfill({ response });
    json.entries = [
      { entry_key: 't-user', kind: 'user', content: content('Miksi laajennusviesti tulee kahdesti?') },
      { entry_key: 't-assistant', kind: 'assistant', content: content('Synteettinen vastaus.'), blocks: [
        { type: 'thinking', text: '**Interpreting extension messages**\n\nThe relay forwards each frame once.' },
        { type: 'thinking', text: 'The user wants to know why the extension message arrives twice when the session is resumed after a restart.\nLet me read the relay first.\n\nThen the journal.' },
        { type: 'thinking', text: 'Checking `relay.go` for a second send.\nNothing there.' },
        { type: 'text', text: 'Synteettinen vastaus.' },
      ] },
    ];
    await route.fulfill({ response, json });
  });
  await page.goto(`${origin}/agents/pi:a1a1a1a1-0000-4000-8000-000000000002`);
  await page.getByRole('button', { name: /PI.*3 ajatusta/ }).click();
  await expect(page.getByRole('button', { name: /^Ajattelu · The user wants/ })).toBeVisible();
  await page.waitForTimeout(1500); // let the work rows finish revealing
  await snapshot(page, `issues/thinking-title-fallback/lab-${tag}-titles`);
  await browser.close();
}
