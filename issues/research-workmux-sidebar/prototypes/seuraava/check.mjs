// Builds index.html and checks it offline: every direction at 1440 and 390 px in light and dark,
// device scale factor 2. From Rupeama 29 the direction's own control walks Sinun vuorosi most
// recent first (Iltakierros, Kuvien pakkaus, Sääaseman CSV-vienti) and then cycles; a seen reply
// leaves Sinun vuorosi; Alt+↓ does the same walk and Alt+↑ steps back; in Sirut the chips are
// numbered and Alt+2 opens the second; once the question is answered nothing waits and the
// control says so; nothing overflows sideways; no console errors, no network requests.
//   PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright node issues/research-workmux-sidebar/prototypes/seuraava/check.mjs
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { run } from '../shared/check-lib.mjs';

const dir = path.dirname(fileURLToPath(import.meta.url));
const NAMES = ['1-ylapalkki', '2-sirut', '3-lopussa'];
await run(dir, 'research-workmux-sidebar/seuraava', async (t) => {
  const { p } = t;
  const title = () => p.locator('[data-testid="conv-title"]').innerText();
  const yoursCount = () => p.locator('[data-testid="rail-yours"] .row').count();
  for (let v = 0; v < 3; v++) {
    await t.pick(v);
    const key = NAMES[v];
    await t.scene('many');
    assert.equal(await title(), 'Rupeama 29');
    // The direction's control is where it says.
    const step = async () => {
      if (v === 1) {
        // Sirut: the first chip that needs the person and is not the current one.
        const id = await p.locator('.chip.yours:not([aria-current])').first().getAttribute('data-open');
        await p.locator(`[data-testid="chip-${id}"]`).click();
      } else await p.locator('[data-testid="next"]').click();
    };
    if (v === 0) assert.match(await p.locator('[data-testid="next"]').getAttribute('aria-label'), /Iltakierros/);
    if (v === 1) {
      assert.equal(await p.locator('[data-testid="strip"] .chip').count(), 16, 'every live conversation is a chip');
      assert.equal(await p.locator('[data-testid="strip"] .chip.yours').count(), 3);
    }
    if (v === 2) assert.match(await p.locator('[data-testid="next-card"]').innerText(), /\+2 muuta[\s\S]*Iltakierros[\s\S]*Kysyy sinulta/);
    await t.fit(key); await t.shot(key + '-alku', true);

    await step();
    assert.equal(await title(), 'Iltakierros', `${key}: most recent first`);
    if (v === 2) assert.match(await p.locator('[data-testid="next-card"]').innerText(), /Kuvien pakkaus/);
    await t.fit(key + ' step'); await t.shot(key + '-kysymys', true);
    await step();
    assert.equal(await title(), 'Kuvien pakkaus');
    if (t.phone) await t.drawer();
    assert.equal(await yoursCount(), 2, `${key}: the seen reply leaves Sinun vuorosi`);
    await t.closeDrawer();
    await t.shot(key + '-vastaus');

    // The keyboard walks the same way and steps back.
    await p.keyboard.press('Alt+ArrowDown');
    assert.equal(await title(), 'Sääaseman CSV-vienti', `${key}: Alt+↓`);
    await p.keyboard.press('Alt+ArrowUp');
    assert.equal(await title(), 'Kuvien pakkaus', `${key}: Alt+↑`);
    // Both replies are now seen, so only the question still needs the person: the walk cycles to it.
    await p.keyboard.press('Alt+ArrowDown');
    assert.equal(await title(), 'Iltakierros', `${key}: the walk cycles`);
    if (v === 1) {
      await p.keyboard.press('Alt+Digit2');
      assert.equal(await title(), 'Kuvien pakkaus', 'Alt+2: the first Käynnissä chip after the one question');
      await p.locator('[data-testid="chip-c1"]').click();
    }

    // Answering the question empties Sinun vuorosi; the control says nothing waits.
    await p.locator('[data-testid="ask"] button').first().click();
    if (v === 0) assert.equal(await p.locator('[data-testid="next"]').getAttribute('aria-disabled'), 'true');
    if (v === 1) assert.match(await p.locator('[data-testid="strip"]').innerText(), /Mikään ei odota sinua/);
    if (v === 2) assert.equal(await p.locator('[data-testid="next-none"]').count(), 1);
    await p.keyboard.press('Alt+ArrowDown');
    assert.match(await p.locator('.toast').innerText(), /Mikään muu ei odota sinua/);
    await t.fit(key + ' empty'); await t.shot(key + '-tyhja', true);
  }
});
