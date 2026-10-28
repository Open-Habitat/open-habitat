// Builds index.html and checks it offline: every direction at 1440 and 390 px in light and dark,
// device scale factor 2. Every row is one line with one ball; the four balls appear; direction 1
// shows nothing after the name, 2 the time, 3 the state's fact (kysyy, epäonnistui, 6 workeria);
// rows get denser from 3 to 1 on the desktop and are 40 px on the phone; the ten workers sit in
// kasvimaa's group with the quiet one folded and the failed one shown; opening a worker from the
// fold keeps it in the group as the current row; the legend opens; nothing overflows sideways; no
// console errors, no network requests.
//   PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright node issues/research-workmux-sidebar/prototypes/ryhmat-tiivis/check.mjs
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { run } from '../shared/check-lib.mjs';

const dir = path.dirname(fileURLToPath(import.meta.url));
const NAMES = ['1-pallo', '2-aika', '3-tieto'];
const HEIGHT = [22, 24, 26];
await run(dir, 'research-workmux-sidebar/ryhmat-tiivis', async (t) => {
  const { p } = t;
  for (let v = 0; v < 3; v++) {
    await t.pick(v);
    const key = NAMES[v];
    await t.scene('many');
    await t.drawer();
    const rows = p.locator('[data-testid="rail"] .line');
    // One line each: a single ball, a single-line height.
    const heights = await rows.evaluateAll(rs => rs.map(r => Math.round(r.getBoundingClientRect().height)));
    const want = t.phone ? 40 : HEIGHT[v];
    assert.ok(heights.length >= 17 && heights.every(h => h === want), `${key}: every row ${want} px, got ${[...new Set(heights)]}`);
    assert.deepEqual(await rows.evaluateAll(rs => rs.map(r => r.querySelectorAll('.ball').length).filter(n => n !== 1)), []);
    for (const b of ['you', 'work', 'done', 'fail']) assert.ok(await p.locator(`[data-testid="rail"] .line[data-ball="${b}"]`).count(), `${key}: a ${b} ball`);
    // Kasvimaa's ten workers: nine shown in Sinun vuorosi or the group, the quiet one folded.
    const kasvi = p.locator('[data-testid="group-kasvimaa"]');
    assert.equal(await kasvi.locator('.grp-head .count').innerText(), '10', 'Rupeama 29 and the nine workers that are not your turn');
    assert.equal(await kasvi.locator('[data-testid="row-w8"]').count(), 1, 'the failed worker is not folded');
    assert.equal(await kasvi.locator('[data-testid="row-w7"]').count(), 0, 'the quiet worker is folded');
    assert.equal(await p.locator('[data-testid="rail-yours"] [data-testid="row-w9"]').count(), 1);
    const end = p.locator('[data-testid="row-w8"]');
    if (v === 0) assert.equal(await end.locator('time, .fact').count(), 0, 'nothing after the name');
    if (v === 1) assert.equal(await end.locator('time').innerText(), '18 min');
    if (v === 2) {
      assert.equal(await end.locator('.fact').innerText(), 'epäonnistui');
      assert.equal(await p.locator('[data-testid="row-c1"] .fact').innerText(), 'kysyy');
      assert.equal(await p.locator('[data-testid="row-c4"] .fact').innerText(), '6 workeria');
    }
    assert.match(await end.getAttribute('title'), /Kylvökalenterin testit · kasvimaa · Epäonnistui · epäonnistui · 18 min/);
    await t.fit(key); await t.shot(key + '-lista', true);

    // Open the quiet worker from the fold, close the fold: the current row stays.
    await p.locator('[data-testid="fold-q:kasvimaa"]').click();
    await p.locator('[data-testid="row-w7"]').click();
    assert.equal(await p.locator('[data-testid="conv-title"]').innerText(), 'Mobiilinäkymän otsikko');
    assert.equal(await p.locator('[data-testid="top-ball"] .ball.done').count(), 1);
    await t.drawer();
    // It was the only quiet one, so the fold is gone and the row stands in the group.
    assert.equal(await p.locator('[data-testid="fold-q:kasvimaa"]').count(), 0);
    assert.equal(await kasvi.locator('[data-testid="row-w7"][aria-current="page"]').count(), 1);
    await t.shot(key + '-taite');
    await t.closeDrawer();

    if (v === 2 && !t.phone) {
      await p.locator('#legend').click();
      assert.equal(await p.locator('[data-testid="legend"] .ball').count(), 4);
      await t.shot(key + '-selite');
      await p.locator('#legend').click();
    }
    await t.scene('few');
    await t.drawer();
    await t.fit(key + ' few'); await t.shot(key + '-hiljainen');
    await t.closeDrawer();
  }
});
