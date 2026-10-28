// Builds index.html and checks it offline: every direction at 1440 and 390 px in light and dark,
// device scale factor 2. The many-scene rail groups the eight kasvimaa workers the way the
// direction says (Ryhmät: a header with its count and folded quiet rows, kotisivu under
// Hiljaiset; Kooste: one "8 workeria" row that opens in place; Työtiloissa: rows under their
// workspace and no Käynnissä section); a fold opens and closes; the current conversation is never
// folded away; opening a new reply moves it out of Sinun vuorosi; ↓ N lisää counts the rows below
// the fold and scrolls to them; nothing overflows sideways; no console errors, no network.
//   PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright node issues/research-workmux-sidebar/prototypes/kaynnissa-ryhmat/check.mjs
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { run } from '../shared/check-lib.mjs';

const dir = path.dirname(fileURLToPath(import.meta.url));
const NAMES = ['1-ryhmat', '2-kooste', '3-tyotiloissa'];
await run(dir, 'research-workmux-sidebar/kaynnissa-ryhmat', async (t) => {
  const { p } = t;
  const rail = p.locator('[data-testid="rail"]');
  const yoursCount = () => p.locator('[data-testid="rail-yours"] .row').count();
  for (let v = 0; v < 3; v++) {
    await t.pick(v);
    const key = NAMES[v];
    await t.scene('many');
    await t.drawer();
    assert.equal(await yoursCount(), 3, `${key}: three in Sinun vuorosi`);
    if (v === 0) {
      assert.match(await p.locator('[data-testid="group-kasvimaa"] .grp-head').innerText(), /kasvimaa\s*9/);
      assert.match(await p.locator('[data-testid="fold-q:kasvimaa"]').innerText(), /2 hiljaista/);
      assert.equal(await p.locator('[data-testid="row-w7"]').count(), 0, 'quiet rows fold');
      assert.equal(await p.locator('[data-testid="rule-quiet"]').count(), 1);
      assert.equal(await p.locator('[data-testid="fold-d:kotisivu"]').count(), 1, 'an all-quiet workspace is one row under Hiljaiset');
      assert.doesNotMatch(await p.locator('[data-testid="row-w1"] .det').innerText(), /kasvimaa/, 'the header names the workspace');
    } else if (v === 1) {
      const sum = p.locator('[data-testid="fold-w:kasvimaa"]');
      assert.match(await sum.innerText(), /8 workeria/);
      assert.match(await sum.innerText(), /6 työskentelee · 2 odottaa viestiä/);
      assert.equal(await p.locator('[data-testid="row-w1"]').count(), 0, 'workers fold into the summary');
      assert.equal(await p.locator('[data-testid="row-c4"]').count(), 1, 'conversations stay rows');
    } else {
      assert.equal(await p.locator('[data-testid="rail-running"]').count(), 0, 'no Käynnissä section');
      assert.equal(await p.locator('[data-testid="group-kasvimaa"] [data-testid="row-w1"]').count(), 1, 'live rows under their workspace');
      assert.match(await p.locator('[data-testid="fold-u:kasvimaa"]').innerText(), /2 hiljaista/);
    }
    await t.fit(key); await t.shot(key + '-lista', true);

    // Open the fold.
    const fold = v === 0 ? 'fold-q:kasvimaa' : v === 1 ? 'fold-w:kasvimaa' : 'fold-u:kasvimaa';
    await p.locator(`[data-testid="${fold}"]`).click();
    assert.equal(await p.locator(`[data-testid="${fold}"]`).getAttribute('aria-expanded'), 'true');
    assert.equal(await p.locator('[data-testid="row-w7"]').count(), 1, `${key}: the fold opens`);
    await t.fit(key + ' open'); await t.shot(key + '-auki', true);

    // The current conversation is never folded away.
    await p.locator('[data-testid="row-w7"]').click();
    await t.drawer();
    await p.locator(`[data-testid="${fold}"]`).click();
    assert.equal(await p.locator(`[data-testid="${fold}"]`).getAttribute('aria-expanded'), 'false');
    assert.equal(await p.locator('[data-testid="row-w7"][aria-current="page"]').count(), 1, `${key}: current stays visible`);
    assert.equal(await p.locator('[data-testid="row-w8"]').count(), 0, `${key}: the rest folds`);
    await t.shot(key + '-nykyinen');

    // Opening a new reply moves it out of Sinun vuorosi into the live rows, as today.
    await p.locator('[data-testid="rail-yours"] [data-testid="row-c2"]').click();
    assert.equal(await p.locator('[data-testid="conv-title"]').innerText(), 'Kuvien pakkaus');
    await t.drawer();
    assert.equal(await yoursCount(), 2, `${key}: the seen reply leaves Sinun vuorosi`);
    assert.equal(await p.locator('[data-testid="row-c2"][aria-current="page"]').count(), 1);

    // ↓ N lisää follows what is below the fold.
    const more = p.locator('[data-testid="more"]');
    const overflow = await p.locator('[data-testid="rail-scroll"]').evaluate(n => n.scrollHeight > n.clientHeight + 4);
    if (overflow) {
      await p.locator('[data-testid="rail-scroll"]').evaluate(n => { n.scrollTop = 0; n.dispatchEvent(new Event('scroll')); });
      assert.equal(await more.isVisible(), true, `${key}: ↓ N lisää shows`);
      const n = Number(await more.locator('.n').innerText());
      assert.ok(n > 0);
      await t.shot(key + '-lisaa');
      await more.click();
      const after = await more.isVisible() ? Number(await more.locator('.n').innerText()) : 0;
      assert.ok(after < n, `${key}: ↓ N lisää scrolls`);
    }
    await t.closeDrawer();

    // A quiet evening: four conversations, nothing to fold.
    await t.scene('few');
    await t.drawer();
    assert.equal(await p.locator('.fold[data-key^="q:"], .fold[data-key^="u:"]').count() <= 1, true);
    await t.fit(key + ' few'); await t.shot(key + '-hiljainen');
    await t.closeDrawer();
    if (t.phone) assert.equal(await rail.evaluate(n => n.getBoundingClientRect().right <= 0), true, 'the drawer closes');
  }
});
