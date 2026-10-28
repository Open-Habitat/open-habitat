// Builds index.html and checks it offline: every direction at 1440 and 390 px in light and dark,
// device scale factor 2. In Iltakierros, which asks the person, nothing is offered. After the
// answer: Heti offers Kuvien pakkaus at once, Työssä once the run is confirmed (docked above
// the composer, outside the stream), Valmiina only when the reply is done. Handled elsewhere, the
// offer moves to Sääaseman CSV-vienti and says so; Alt+↓ opens it, after which nothing else waits;
// Alt+↑ steps back. The loop: Alt+↓ while Iltakierros still works, and when it finishes it is
// offered in Kuvien pakkaus as a new reply. Nothing overflows sideways; no console errors, no
// network requests.
//   PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright node issues/research-workmux-sidebar/prototypes/lopussa-keskustelussa/check.mjs
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { run } from '../shared/check-lib.mjs';

const dir = path.dirname(fileURLToPath(import.meta.url));
const NAMES = ['1-heti', '2-tyossa', '3-valmiina'];
await run(dir, 'research-workmux-sidebar/lopussa-keskustelussa', async (t) => {
  const { p } = t;
  const title = () => p.locator('[data-testid="conv-title"]').innerText();
  // Read now, without waiting: the offer's absence is what several steps check.
  const offer = () => p.evaluate(() => document.querySelector('[data-testid="offer"]')?.dataset.offer ?? null);
  const phase = (ph) => p.locator(`[data-testid="live"][data-phase="${ph}"]`).waitFor({ timeout: 8000 });
  for (let v = 0; v < 3; v++) {
    await t.pick(v);
    const key = NAMES[v];
    await p.locator('#reset').click();
    assert.equal(await title(), 'Iltakierros');
    assert.equal(await p.locator('[data-testid="offer"], [data-testid="offer-none"]').count(), 0, `${key}: nothing offered while this one asks`);
    await t.fit(key); await t.shot(key + '-1-kysyy');

    await p.locator('[data-testid="ask"] button').first().click();
    assert.equal(await p.locator('[data-testid="live"][data-phase="sent"]').count(), 1);
    assert.equal(await offer(), v === 0 ? 'c2' : null, `${key}: right after sending`);
    await t.shot(key + '-2-lahetetty');
    await phase('working');
    assert.equal(await offer(), v === 2 ? null : 'c2', `${key}: while working`);
    if (v === 1) assert.equal(await p.locator('.main > .dock [data-testid="offer-open"]').count(), 1, 'docked outside the stream');
    if (v === 0) assert.ok(await p.locator('[data-testid="live"] ~ [data-testid="offer"]').count(), 'the card is after the live reply');
    await p.waitForTimeout(700);
    await t.fit(key + ' working'); await t.shot(key + '-3-tyossa', true);
    await phase('done');
    assert.equal(await offer(), 'c2', `${key}: done`);
    assert.match(await p.locator('[data-testid="offer"]').innerText(), /Kuvien pakkaus/);
    await t.shot(key + '-4-valmis');

    await p.locator('#elsewhere').click();
    assert.equal(await offer(), 'c3', `${key}: handled elsewhere, the next one`);
    assert.match(await p.locator('[data-testid="offer-note"]').innerText(), /Kuvien pakkaus hoidettiin toisaalla/);
    await t.fit(key + ' elsewhere'); await t.shot(key + '-5-toisaalla');

    await p.keyboard.press('Alt+ArrowDown');
    assert.equal(await title(), 'Sääaseman CSV-vienti', `${key}: Alt+↓ opens the offer`);
    assert.equal(await p.locator('[data-testid="offer"]').count(), 0, `${key}: nothing else waits`);
    if (v !== 1) assert.equal(await p.locator('[data-testid="offer-none"]').count(), 1);
    await t.shot(key + '-6-tyhja');
    await p.keyboard.press('Alt+ArrowUp');
    assert.equal(await title(), 'Iltakierros', `${key}: Alt+↑`);

    // The loop: leave while the agent works; when it finishes it is offered in the next one.
    await p.locator('#reset').click();
    await p.locator('[data-testid="ask"] button').first().click();
    await phase('working');
    await p.keyboard.press('Alt+ArrowDown');
    assert.equal(await title(), 'Kuvien pakkaus');
    await p.locator('[data-testid="rail-yours"] [data-testid="row-c1"]').waitFor({ state: 'attached', timeout: 8000 });
    assert.equal(await offer(), 'c1', `${key}: the finished one comes back as an offer`);
    assert.match(await p.locator('[data-testid="offer"]').textContent(), /Iltakierros[\s\S]*uusi vastaus/);
    await t.fit(key + ' loop'); await t.shot(key + '-7-silmukka');
  }
});
