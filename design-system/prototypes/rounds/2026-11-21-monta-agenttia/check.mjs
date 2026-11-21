// node check.mjs <built.html> <out-dir>
// Playwright from web/node_modules (PROTO_WEB=<dir with package.json and
// node_modules> borrows another checkout's). Each form at 1440 and 390, with
// reduced motion: the floating picker holds (picker-check.mjs); the hero image
// is whole and centred; the page does not scroll sideways; no request leaves the
// file; the console is clean; a tool row opens and closes, an offered file
// answers, and each form's own interactions work:
//   1 Sivupalkki: the screen, clock and sidebar follow the step in view, a
//     sidebar row opens its conversation, the video plays; on the phone the
//     state bar opens the sidebar and a row replaces the step's screen.
//   2 Kaistat: the time slider moves the cursor and the counts, a pin opens its
//     glimpse, Earlier/Later page, Play the day advances the clock.
//   3 Hetket: a moment opens its glimpse in a dialog, the arrows page inside it
//     without flipping the picker, Esc closes it, a highlighted sidebar row opens.
// Writes screenshots <n>-<width>-<what>.png.
import { createRequire } from 'node:module';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync, mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';
import { checkPicker } from '../../picker-check.mjs';

const ROUND = '2026-11-21-monta-agenttia';
const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../../..');
const require = createRequire(join(process.env.PROTO_WEB || join(root, 'web'), 'package.json'));
const { chromium } = require('playwright');
const [input, out] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const html = readFileSync(input, 'utf8');
const browser = await chromium.launch();
const errors = [];
const settle = (page, ms = 400) => page.waitForTimeout(ms);
const scrollMid = (loc) => loc.evaluate((e) => window.scrollTo(0, e.getBoundingClientRect().top + scrollY + Math.min(e.offsetHeight, innerHeight) / 2 - innerHeight / 2));

for (const width of [1440, 390]) {
  for (const d of [0, 1, 2]) {
    const tag = `${d + 1}@${width}`;
    const phone = width === 390;
    const ctx = await browser.newContext({ viewport: { width, height: phone ? 844 : 900 }, deviceScaleFactor: phone ? 2 : 1, isMobile: phone, hasTouch: phone, reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(`${tag} ${e.message}`));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`${tag} ${m.text()}`); });
    await page.route('**/*', (r) => (r.request().url().startsWith('http://prototype.test/') ? r.fulfill({ contentType: 'text/html', body: html }) : (errors.push(`network: ${r.request().url()}`), r.abort())));
    await page.goto(`http://prototype.test/?v=${d + 1}`);
    await page.locator(`.v${d + 1}`).waitFor();
    await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map((i) => i.decode())); });
    await settle(page);
    await checkPicker(page, ROUND);
    await page.screenshot({ path: join(out, `${d + 1}-${width}-top.png`) });

    const hero = await page.evaluate(() => { const r = document.querySelector('.hero-img').getBoundingClientRect(); return { l: r.left, r: r.right, vw: innerWidth }; });
    assert.ok(hero.l >= 0 && hero.r <= hero.vw + 0.5 && Math.abs((hero.l + hero.r) / 2 - hero.vw / 2) <= 1, `${tag}: hero image not whole and centred`);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${tag}: horizontal overflow`);
    await page.locator('#day').evaluate((e) => window.scrollTo(0, e.getBoundingClientRect().top + scrollY));
    await settle(page);
    await page.screenshot({ path: join(out, `${d + 1}-${width}-day.png`) });

    const toolRow = async (scope) => {
      const disc = await page.locator(`${scope} .disc[aria-expanded="false"]:visible`).first().elementHandle();
      await disc.scrollIntoViewIfNeeded();
      await disc.click();
      assert.equal(await disc.getAttribute('aria-expanded'), 'true', `${tag}: tool row opens`);
      assert.ok(await disc.evaluate((b) => b.nextElementSibling.checkVisibility()), `${tag}: tool output shows`);
      await disc.click();
      assert.ok(await disc.evaluate((b) => !b.nextElementSibling.checkVisibility()), `${tag}: tool output closes`);
    };

    if (d === 0) {
      const steps = page.locator('.s1-step');
      assert.equal(await steps.count(), 10, `${tag}: ten steps`);
      if (!phone) {
        for (const i of [1, 3, 5, 6, 9]) {
          await scrollMid(steps.nth(i));
          await settle(page);
          assert.equal(await page.locator('.s1-step.on').getAttribute('data-i'), String(i), `${tag}: step ${i} on`);
          const want = await steps.nth(i).locator('.s1-when .when > b').textContent();
          assert.equal(await page.locator('.s1-clock .when > b').textContent(), want, `${tag}: clock follows step ${i}`);
          assert.equal(await page.locator('.s1-rail .rl-row[aria-current]').count(), 1, `${tag}: one current row`);
          await page.screenshot({ path: join(out, `${d + 1}-${width}-step${i}.png`) });
        }
        // At 08:34 three conversations run at once.
        await scrollMid(steps.nth(1)); await settle(page);
        assert.equal(await page.locator('.s1-rail .rl-sec-run .rl-row').count(), 2, `${tag}: two running at 08:34 beside the one that just came back`);
        await scrollMid(steps.nth(3)); await settle(page);
        await page.locator('.s1-main .vid-play').click();
        await settle(page, 600);
        assert.ok(await page.locator('.s1-main .vid.playing').count(), `${tag}: video plays`);
        await toolRow('.s1-main');
        await page.locator('.s1-rail .rl-row[data-s="receipts"]').click();
        assert.match(await page.locator('.s1-main .scr-bar b').textContent(), /October receipts/, `${tag}: a sidebar row opens its conversation`);
        await page.locator('.s1-main .offer-b').count() && (await page.locator('.s1-main .offer-b').first().click());
        await scrollMid(steps.nth(8)); await settle(page);
        const undo = page.locator('.s1-main [data-undo]');
        await undo.click();
        assert.equal(await undo.textContent(), 'Redo', `${tag}: undo answers`);
        const dl = page.locator('.s1-main .offer-b'); // step 8 has none; use step 7
        await scrollMid(steps.nth(7)); await settle(page);
        await page.locator('.s1-main .offer-b').click();
        assert.equal((await page.locator('.s1-main .offer-b').textContent()).trim(), 'Saved to Downloads', `${tag}: offered file answers`);
        void dl;
      } else {
        for (let i = 0; i < 10; i++) {
          await steps.nth(i).evaluate((e) => window.scrollTo(0, e.getBoundingClientRect().top + scrollY - 60));
          await settle(page, 200);
          await page.screenshot({ path: join(out, `${d + 1}-${width}-step${i}.png`) });
        }
        await scrollMid(steps.nth(2)); await settle(page);
        const bar = page.locator('.s1-bar');
        assert.ok(await bar.isVisible(), `${tag}: state bar shows`);
        assert.equal(await bar.locator('.when > b').textContent(), '08:41', `${tag}: state bar follows the step`);
        await page.locator('.s1-tog').click();
        assert.ok(await page.locator('.s1-drop').isVisible(), `${tag}: sidebar opens from the bar`);
        await page.screenshot({ path: join(out, `${d + 1}-${width}-drop.png`) });
        await page.locator('.s1-drop .rl-row[data-s="video"]').click();
        await settle(page);
        assert.ok(await page.locator('.s1-drop').isHidden(), `${tag}: sidebar closes`);
        assert.match(await steps.nth(2).locator('.s1-inline .scr-bar b').textContent(), /Market video/, `${tag}: row replaces the step's screen`);
        await page.screenshot({ path: join(out, `${d + 1}-${width}-row.png`) });
        await toolRow('.s1-step');
      }
    }

    if (d === 1) {
      const card = page.locator('.s2-card');
      await card.scrollIntoViewIfNeeded();
      await card.evaluate((e) => window.scrollTo(0, e.getBoundingClientRect().top + scrollY - 10));
      await settle(page);
      await page.screenshot({ path: join(out, `${d + 1}-${width}-chart.png`), fullPage: false });
      // 08:32: three running.
      assert.match(await page.locator('.s2-read .c-run').textContent(), /^3 Running/, `${tag}: three running at 08:32`);
      await page.locator('.s2-range').fill(String(12 * 60 + 40));
      await settle(page, 150);
      assert.equal(await page.locator('.s2-read .when > b').textContent(), '12:40', `${tag}: slider moves the clock`);
      assert.equal(await page.locator('.ln-place.on i').textContent(), 'Out for lunch', `${tag}: her place follows`);
      assert.equal(await page.locator('.ln-s[data-s="returns"]').getAttribute('data-state'), 'run', `${tag}: returns runs at lunch`);
      await page.screenshot({ path: join(out, `${d + 1}-${width}-lunch.png`) });
      await page.locator('.ln-pin[data-i="6"]').click();
      await settle(page);
      assert.match(await page.locator('.s2-detail .d2-n').textContent(), /^7\/10/, `${tag}: pin opens its glimpse`);
      assert.equal(await page.locator('.s2-read .when > b').textContent(), '13:35', `${tag}: pin moves the clock`);
      await page.locator('.s2-detail .d2-b[data-step="1"]').click();
      assert.match(await page.locator('.s2-detail .d2-n').textContent(), /^8\/10/, `${tag}: Later pages`);
      await page.locator('.s2-detail').scrollIntoViewIfNeeded();
      await page.screenshot({ path: join(out, `${d + 1}-${width}-detail.png`) });
      await toolRow('.s2-detail');
      await page.locator('.s2-detail .offer-b').click();
      assert.equal((await page.locator('.s2-detail .offer-b').textContent()).trim(), 'Saved to Downloads', `${tag}: offered file answers`);
      await page.locator('.s2-range').fill(String(8 * 60));
      await page.locator('.s2-play').click();
      await settle(page, 2000);
      const t = await page.locator('.s2-range').inputValue();
      assert.ok(+t > 8 * 60, `${tag}: Play the day advances (${t})`);
      await page.locator('.s2-play').click();
      assert.equal((await page.locator('.s2-play span').textContent()), 'Play the day', `${tag}: Play pauses`);
    }

    if (d === 2) {
      assert.equal(await page.locator('.s3-m').count(), 8, `${tag}: eight moments`);
      await page.locator('.s3-m').nth(phone ? 2 : 0).scrollIntoViewIfNeeded();
      await page.screenshot({ path: join(out, `${d + 1}-${width}-moments.png`) });
      await page.locator('.s3-b[data-i="2"]').click();
      await settle(page);
      const dlg = page.locator('.s3-dlg');
      assert.ok(await dlg.evaluate((e) => e.open), `${tag}: dialog opens`);
      assert.match(await dlg.locator('.d2-n').textContent(), /^3\/10/, `${tag}: the right glimpse`);
      await page.screenshot({ path: join(out, `${d + 1}-${width}-dialog.png`) });
      await page.keyboard.press('ArrowRight');
      assert.match(await dlg.locator('.d2-n').textContent(), /^4\/10/, `${tag}: → pages in the dialog`);
      assert.ok(await page.locator('.v3').count(), `${tag}: → did not flip the picker`);
      await toolRow('.s3-dlg');
      await dlg.locator('.vid-play').click();
      await page.keyboard.press('Escape');
      assert.ok(!(await dlg.evaluate((e) => e.open)), `${tag}: Esc closes`);
      await page.locator('.s3-m').nth(4).locator('.rl-row.hot').first().click();
      assert.match(await dlg.locator('.d2-n').textContent(), /^6\/10/, `${tag}: highlighted row opens its glimpse`);
      await page.screenshot({ path: join(out, `${d + 1}-${width}-phone-glimpse.png`) });
      await dlg.locator('.s3-x').click();
      assert.ok(!(await dlg.evaluate((e) => e.open)), `${tag}: × closes`);
    }

    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${tag}: horizontal overflow after interactions`);
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await settle(page);
    const pk = await page.evaluate(() => { const p = document.querySelector('.proto-picker').getBoundingClientRect(); const f = [...document.querySelectorAll('.foot > *')].map((e) => e.getBoundingClientRect()); return f.some((r) => r.bottom > p.top && r.top < p.bottom && r.right > p.left && r.left < p.right); });
    assert.equal(pk, false, `${tag}: picker covers the footer`);
    await page.screenshot({ path: join(out, `${d + 1}-${width}-end.png`) });

    await page.keyboard.press('ArrowRight');
    await settle(page);
    assert.ok(await page.locator(`.v${((d + 1) % 3) + 1}`).count(), `${tag}: → flips to the next form`);
    await ctx.close();
  }
}
await browser.close();
assert.deepEqual(errors, [], `errors:\n${errors.join('\n')}`);
console.log('ok: 3 forms × 2 widths');
