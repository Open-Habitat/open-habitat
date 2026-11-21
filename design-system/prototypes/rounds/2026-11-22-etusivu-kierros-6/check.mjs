// node check.mjs <built.html> <out-dir>
// Playwright from web/node_modules (PROTO_WEB=<dir with package.json and
// node_modules> borrows another checkout's). Each variant at 1440 and 390, with
// reduced motion: the floating picker holds (picker-check.mjs); the hero image
// is whole and centred; the page does not scroll sideways; no request leaves the
// file; the console is clean. In every variant:
//   Alice's day has twelve glimpses; on the desktop the screen, clock and
//   sidebar follow the step in view (two running at 08:34, three waiting at
//   13:35), a sidebar row opens its conversation, a tool row opens and closes,
//   the video plays, the order page counts, undo and an offered file answer;
//   on the phone the state bar opens the sidebar and a row replaces the step's
//   screen. The capabilities section holds all 56 (15 in full, 20 as lines
//   pointing to someone's day, 21 in lists), a group's list and an item open, a
//   view toggle answers, and a pointer line takes the reader to Carol's tote.
//   1 Oma osio: six role sections of three glimpses each, each with its own screen.
//   2 Rinnakkaiset päivät: seven colleague glimpses between Alice's, one or more
//     from each of the six; the screen becomes the colleague's own.
//   3 Valitse kenen päivä: Alice's day is followed by three glimpses from her
//     other weeks; the selector swaps the whole day (Bob: six glimpses), arrows
//     move inside it without flipping the picker, the day's end button opens
//     the next person's day, Carol's tote turns in rust and Erin's ink page answers.
// The page is scrolled to its end, and → flips to the next variant.
// Writes screenshots <n>-<width>-<what>.png.
import { createRequire } from 'node:module';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync, mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';
import { checkPicker } from '../../picker-check.mjs';

const ROUND = '2026-11-22-etusivu-kierros-6';
const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../../..');
const require = createRequire(join(process.env.PROTO_WEB || join(root, 'web'), 'package.json'));
const { chromium } = require('playwright');
const [input, out] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const html = readFileSync(input, 'utf8');
const browser = await chromium.launch();
const errors = [];
const settle = (page, ms = 350) => page.waitForTimeout(ms);
const scrollMid = (loc) => loc.evaluate((e) => window.scrollTo(0, e.getBoundingClientRect().top + scrollY + Math.min(e.offsetHeight, innerHeight) / 2 - innerHeight / 2));
const ALICE_KEY = ['alice', 'alice-mw', 'day-alice'];

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
    if (d === 0) await page.screenshot({ path: join(out, `${d + 1}-${width}-top.png`) });
    const shot = (what) => page.screenshot({ path: join(out, `${d + 1}-${width}-${what}.png`) });

    const hero = await page.evaluate(() => { const r = document.querySelector('.hero-img').getBoundingClientRect(); return { l: r.left, r: r.right, vw: innerWidth }; });
    assert.ok(hero.l >= 0 && hero.r <= hero.vw + 0.5 && Math.abs((hero.l + hero.r) / 2 - hero.vw / 2) <= 1, `${tag}: hero image not whole and centred`);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${tag}: horizontal overflow`);

    const day = page.locator(`.s1[data-story="${ALICE_KEY[d]}"]`);
    const steps = day.locator(':scope > .s1-steps > .s1-step');
    const aliceSteps = day.locator(':scope > .s1-steps > .s1-step:not(.mw-step)');
    assert.equal(await aliceSteps.count(), 12, `${tag}: twelve glimpses in Alice's day`);
    await page.locator('#day').evaluate((e) => window.scrollTo(0, e.getBoundingClientRect().top + scrollY));
    await settle(page);
    await shot('day');

    const toolRow = async (scope) => {
      const disc = await page.locator(`${scope} .disc[aria-expanded="false"]:visible`).first().elementHandle();
      await disc.scrollIntoViewIfNeeded();
      await disc.click();
      assert.equal(await disc.getAttribute('aria-expanded'), 'true', `${tag}: tool row opens`);
      assert.ok(await disc.evaluate((b) => b.nextElementSibling.checkVisibility()), `${tag}: tool output shows`);
      await disc.click();
      assert.ok(await disc.evaluate((b) => !b.nextElementSibling.checkVisibility()), `${tag}: tool output closes`);
    };
    // The index of Alice's n-th glimpse among the section's steps.
    const nth = async (n) => (await aliceSteps.nth(n).getAttribute('data-i'));
    const stepAt = async (n) => steps.nth(+(await nth(n)));
    const main = day.locator('.s1-main');

    if (!phone) {
      for (const n of [1, 5, 7, 10]) {
        const st = await stepAt(n);
        await scrollMid(st); await settle(page);
        assert.equal(await day.locator('.s1-step.on').getAttribute('data-i'), await nth(n), `${tag}: glimpse ${n + 1} on`);
        const want = await st.locator('.s1-when .when > b').textContent();
        assert.equal(await day.locator('.s1-clock .when > b').textContent(), want, `${tag}: clock follows glimpse ${n + 1}`);
        assert.equal(await day.locator('.s1-rail .rl-row[aria-current]').count(), 1, `${tag}: one current row`);
        if (d === 0 || n === 5) await shot(`g${n + 1}`);
      }
      await scrollMid(await stepAt(1)); await settle(page);
      assert.equal(await day.locator('.s1-rail .rl-sec-run .rl-row').count(), 2, `${tag}: two running at 08:34`);
      await scrollMid(await stepAt(7)); await settle(page);
      assert.equal(await day.locator('.s1-rail .rl-sec-turn .rl-row').count(), 3, `${tag}: three waiting at 13:35`);
      await scrollMid(await stepAt(3)); await settle(page);
      await main.locator('.vid-play').click(); await settle(page, 500);
      assert.ok(await main.locator('.vid.playing').count(), `${tag}: video plays`);
      await toolRow(`.s1[data-story="${ALICE_KEY[d]}"] .s1-main`);
      await day.locator('.s1-rail .rl-row[data-s="receipts"]').click();
      assert.match(await main.locator('.scr-bar b').textContent(), /October receipts/, `${tag}: a sidebar row opens its conversation`);
      await scrollMid(await stepAt(9)); await settle(page);
      const undo = main.locator('[data-undo]');
      await undo.click();
      assert.equal(await undo.textContent(), 'Redo', `${tag}: undo answers`);
      await scrollMid(await stepAt(10)); await settle(page);
      const plus = main.locator('.op-row[data-k="1"] .op-b[data-d="1"]');
      await plus.click(); await plus.click();
      assert.equal(await main.locator('.op-sum').textContent(), '€202.00', `${tag}: the order page counts`);
      await scrollMid(await stepAt(8)); await settle(page);
      await main.locator('.offer-b').click();
      assert.equal((await main.locator('.offer-b').textContent()).trim(), 'Saved to Downloads', `${tag}: offered file answers`);
      if (d === 0) await shot('g9-offer');
    } else {
      for (const n of d === 0 ? [0, 5, 6, 10, 11] : [5]) {
        const st = await stepAt(n);
        await st.evaluate((e) => window.scrollTo(0, e.getBoundingClientRect().top + scrollY - 60));
        await settle(page, 200);
        await shot(`g${n + 1}`);
      }
      await scrollMid(await stepAt(2)); await settle(page);
      const bar = day.locator('.s1-bar');
      assert.ok(await bar.isVisible(), `${tag}: state bar shows`);
      assert.equal(await bar.locator('.when > b').textContent(), '08:41', `${tag}: state bar follows the step`);
      await day.locator('.s1-tog').click();
      assert.ok(await day.locator('.s1-drop').isVisible(), `${tag}: sidebar opens from the bar`);
      if (d === 0) await shot('drop');
      await day.locator('.s1-drop .rl-row[data-s="video"]').click();
      await settle(page);
      assert.ok(await day.locator('.s1-drop').isHidden(), `${tag}: sidebar closes`);
      assert.match(await (await stepAt(2)).locator('.s1-inline .scr-bar b').textContent(), /Market video/, `${tag}: row replaces the step's screen`);
      await toolRow(`.s1[data-story="${ALICE_KEY[d]}"] .s1-step`);
      const st10 = await stepAt(10);
      await st10.locator('.op-row[data-k="3"] .op-b[data-d="1"]').click();
      assert.equal(await st10.locator('.op-sum').textContent(), '€192.00', `${tag}: the order page counts`);
    }

    if (d === 0) {
      const roles = page.locator('.role');
      assert.equal(await roles.count(), 6, `${tag}: six roles`);
      for (let k = 0; k < 6; k++) assert.equal(await roles.nth(k).locator('.s1-step').count(), 3, `${tag}: role ${k + 1} has three glimpses`);
      const kirsi = page.locator('.s1[data-story="role-kirsi"]');
      await page.locator('#roles').evaluate((e) => window.scrollTo(0, e.getBoundingClientRect().top + scrollY));
      await settle(page); await shot('roles');
      const st = kirsi.locator('.s1-step').nth(2);
      await scrollMid(st); await settle(page);
      if (!phone) {
        assert.match(await kirsi.locator('.s1-top').textContent(), /Kirsi/, `${tag}: Kirsi's own screen`);
        assert.match(await kirsi.locator('.s1-main .scr-bar b').textContent(), /Budget and cash/, `${tag}: the role screen follows`);
      }
      await shot('role-kirsi');
    }
    if (d === 1) {
      assert.equal(await day.locator('.mw-step').count(), 7, `${tag}: seven colleague glimpses`);
      const who = await day.locator('.mw-step .who-tag b').allTextContents();
      for (const n of ['Bob', 'Kirsi', 'Carol', 'Dave', 'Erin', 'Frank']) assert.ok(who.includes(n), `${tag}: ${n} has a meanwhile glimpse`);
      const mw = day.locator('.mw-step').nth(4);
      await scrollMid(mw); await settle(page);
      if (!phone) {
        assert.ok(await day.locator('.s1-app.mw-app').count(), `${tag}: the screen marks a colleague's`);
        assert.match(await day.locator('.s1-top').textContent(), /Carol/, `${tag}: Carol's own screen`);
        assert.match(await day.locator('.s1-rail').textContent(), /Winter prints cut-outs/, `${tag}: Carol's own sidebar`);
      }
      await shot('meanwhile');
      await scrollMid(await stepAt(8)); await settle(page);
      if (!phone) assert.match(await day.locator('.s1-top').textContent(), /Alice/, `${tag}: back to Alice`);
    }
    if (d === 2) {
      assert.equal(await page.locator('.s1[data-story="alice-more"] .s1-step').count(), 3, `${tag}: three glimpses from Alice's other weeks`);
      await scrollMid(page.locator('.s1[data-story="alice-more"] .s1-step').nth(2)); await settle(page);
      await shot('alice-more');
      const pick = page.locator('.who-pick');
      assert.equal(await pick.locator('.who-b').count(), 7, `${tag}: seven people to choose from`);
      await pick.scrollIntoViewIfNeeded();
      await page.locator('.who-b[data-day="bob"]').click(); await settle(page);
      assert.equal(await page.locator('.who-b[aria-checked="true"]').getAttribute('data-day'), 'bob', `${tag}: Bob chosen`);
      assert.equal(await page.locator('.s1[data-story="day-bob"] .s1-step').count(), 6, `${tag}: Bob's day has six glimpses`);
      assert.match(await page.locator('.v3-head h2').textContent(), /Bob’s Thursday, six agents/, `${tag}: the heading follows`);
      await page.locator('#day').evaluate((e) => window.scrollTo(0, e.getBoundingClientRect().top + scrollY));
      await settle(page); await shot('pick-bob');
      const bob = page.locator('.s1[data-story="day-bob"]');
      await scrollMid(bob.locator('.s1-step').nth(2)); await settle(page);
      if (!phone) assert.match(await bob.locator('.s1-main .scr-bar b').textContent(), /Thursday deliveries/, `${tag}: Bob's screen follows`);
      await shot('bob-route');
      await page.locator('.who-b[data-day="bob"]').focus();
      await page.keyboard.press('ArrowRight'); await settle(page);
      assert.ok(await page.locator('.v3').count(), `${tag}: → in the selector did not flip the picker`);
      assert.equal(await page.locator('.who-b[aria-checked="true"]').getAttribute('data-day'), 'kirsi', `${tag}: → moves to Kirsi`);
      for (const id of ['carol', 'dave', 'erin', 'frank']) {
        await page.locator(`.who-b[data-day="${id}"]`).click(); await settle(page, 150);
        const n = await page.locator(`.s1[data-story="day-${id}"] .s1-step`).count();
        assert.ok(n >= 5 && n <= 7, `${tag}: ${id}'s day has 5–7 glimpses`);
      }
      await page.locator('#day').evaluate((e) => window.scrollTo(0, e.getBoundingClientRect().top + scrollY));
      await settle(page); await shot('pick-frank');
      const fr = page.locator('.s1[data-story="day-frank"]');
      await scrollMid(fr.locator('.s1-step').nth(1)); await settle(page);
      await shot('frank-r');
      await page.locator('.next-b').click(); await settle(page);
      assert.equal(await page.locator('.who-b[aria-checked="true"]').getAttribute('data-day'), 'alice', `${tag}: next after Frank is Alice`);
      await page.locator('.who-b[data-day="carol"]').click(); await settle(page);
      const c = page.locator('.s1[data-story="day-carol"]');
      await scrollMid(c.locator('.s1-step').nth(2)); await settle(page);
      const ch = phone ? c.locator('.s1-step').nth(2) : c.locator('.s1-main');
      await ch.locator('.tt [data-set="rust"]').click();
      assert.equal(await ch.locator('.tt').getAttribute('data-state'), 'rust', `${tag}: the tote turns in rust`);
      await shot('carol-tote');
      const gr = page.locator('.who-b[data-day="erin"]'); await gr.click(); await settle(page);
      const g = page.locator('.s1[data-story="day-erin"]');
      await scrollMid(g.locator('.s1-step').nth(2)); await settle(page);
      const host = phone ? g.locator('.s1-step').nth(2) : g.locator('.s1-main');
      await host.locator('.ink [data-set="indigo-yellow"]').click();
      assert.equal(await host.locator('.ink p[data-label]').textContent(), 'Indigo + weld yellow: forest green', `${tag}: ink mixing answers`);
      await shot('erin-ink');
    }

    // Capabilities: all 56, 15 in full, 20 pointing to a day; a list and an item open; a view toggle answers.
    const caps = page.locator('.caps');
    assert.equal(await caps.locator('.cap-g').count(), 8, `${tag}: eight groups`);
    const full = await caps.locator('.s1-step').count(); const listed = await caps.locator('.cap-it').count(); const inDays = await caps.locator('.cap-in').count();
    assert.equal(full, 15, `${tag}: fifteen in full`); assert.equal(inDays, 20, `${tag}: twenty point to a day`); assert.equal(full + listed + inDays, 56, `${tag}: 56 capabilities`);
    for (const id of ['av', 'img', '3d', 'paper', 'maps', 'print', 'data', 'web']) assert.ok(await page.locator(`#cap-${id} .s1-step`).count() >= 1, `${tag}: ${id} has a full screen`);
    await page.locator('#can').evaluate((e) => window.scrollTo(0, e.getBoundingClientRect().top + scrollY));
    await settle(page);
    if (d === 0) await shot('caps');
    const g3 = page.locator('#cap-3d .s1-step').first(); await scrollMid(g3); await settle(page);
    if (d === 0) await shot('cap-3d');
    const gav = page.locator('#cap-av .s1-step').first(); await scrollMid(gav); await settle(page);
    if (d === 0) await shot('cap-timelapse');
    const gm = page.locator('#cap-maps .s1-step').first(); await scrollMid(gm); await settle(page);
    if (d === 0) await shot('cap-drone');
    const gi = page.locator('#cap-img .s1-step').first(); await scrollMid(gi); await settle(page);
    const gis = phone ? gi : page.locator('#cap-img .s1-main');
    await gis.locator('.up [data-set="before"]').click();
    assert.equal(await gis.locator('.up').getAttribute('data-state'), 'before', `${tag}: before/after toggles`);
    if (d === 0) await shot('cap-upscale');
    const days = page.locator('#cap-img .cap-days'); await days.scrollIntoViewIfNeeded(); await settle(page, 150);
    if (d === 0) await shot('cap-days');
    const more = page.locator('#cap-paper .cap-more');
    await more.locator('summary').first().scrollIntoViewIfNeeded();
    await more.locator(':scope > summary').click();
    assert.ok(await more.evaluate((e) => e.open), `${tag}: a group's list opens`);
    const it = more.locator('.cap-it').first();
    await it.locator('summary').click();
    assert.ok(await it.evaluate((e) => e.open), `${tag}: an item opens`);
    await it.scrollIntoViewIfNeeded();
    if (d === 0) await shot('cap-list');
    for (const id of ['paper', 'print', 'data', 'web']) {
      const s = page.locator(`#cap-${id} .s1-step`).first(); await scrollMid(s); await settle(page, 200);
      if (d === 0) await shot(`cap-${id}`);
    }

    // A line in the capabilities points at the glimpse in someone's day.
    const link = page.locator('#cap-3d .cap-role[href="#g-carol-tote"]');
    await link.scrollIntoViewIfNeeded(); await link.click(); await settle(page);
    const target = d === 1 ? '.s1-step[data-who="carol"]' : '#g-carol-tote';
    const seen = await page.locator(target).first().evaluate((e) => { const r = e.getBoundingClientRect(); return r.top < innerHeight && r.bottom > 0; });
    assert.ok(seen, `${tag}: the pointer brings Carol's glimpse into view`);
    if (d === 2) assert.equal(await page.locator('.who-b[aria-checked="true"]').getAttribute('data-day'), 'carol', `${tag}: the pointer chose Carol's day`);
    await shot('pointer');

    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${tag}: horizontal overflow after interactions`);
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await settle(page);
    const pk = await page.evaluate(() => { const p = document.querySelector('.proto-picker').getBoundingClientRect(); const f = [...document.querySelectorAll('.foot > *')].map((e) => e.getBoundingClientRect()); return f.some((r) => r.bottom > p.top && r.top < p.bottom && r.right > p.left && r.left < p.right); });
    assert.equal(pk, false, `${tag}: picker covers the footer`);
    await shot('end');

    await page.locator('body').click({ position: { x: 2, y: 2 } }).catch(() => {});
    await page.evaluate(() => document.activeElement && document.activeElement.blur());
    await page.keyboard.press('ArrowRight');
    await settle(page);
    assert.ok(await page.locator(`.v${((d + 1) % 3) + 1}`).count(), `${tag}: → flips to the next variant`);
    await ctx.close();
  }
}
await browser.close();
assert.deepEqual(errors, [], `errors:\n${errors.join('\n')}`);
console.log('ok: 3 variants × 2 widths');
