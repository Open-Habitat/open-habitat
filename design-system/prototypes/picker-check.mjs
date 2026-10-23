import assert from 'node:assert/strict';

// Closed/superseded comparisons: never exempt a round still offered for review.
export const supersededRounds = new Set([
  '2026-10-12-pitka-komento',
  '2026-10-19-editorin-tila',
  '2026-10-20-bash-runs',
  '2026-10-20-bash-runs-context',
  '2026-10-23-onboarding-person',
]);

export async function checkPicker(page, round, reviewList = '') {
  if (supersededRounds.has(round) && !reviewList.includes(round)) return;
  const picker = page.locator('nav.proto-picker');
  assert.equal(await picker.count(), 1, `${round}: missing prototype picker`);
  assert.ok(await picker.isVisible(), `${round}: picker is hidden`);
  const items = picker.locator('.proto-picker-item:not(.proto-picker-replay)');
  assert.ok(await items.count() > 1, `${round}: picker needs directions`);
  assert.equal(await picker.locator('.proto-picker-item[data-active]').count(), 1, `${round}: exactly one active button`);
  assert.equal(await picker.locator('.proto-picker-item[aria-current="true"]').count(), 1, `${round}: exactly one current button`);
  assert.equal(await picker.locator('.proto-picker-item[data-active][aria-current="true"]').count(), 1,
    `${round}: picker must have exactly one active direction`);
  assert.equal(await picker.locator('.proto-picker-highlight').count(), 1, `${round}: missing sliding highlight`);
  for (const item of await items.all()) {
    const lines = await item.evaluate(el => { const range = document.createRange(); range.selectNodeContents(el); return range.getClientRects().length; });
    assert.equal(lines, 1, `${round}: picker label wraps`);
  }
  const box = await picker.boundingBox();
  const width = await page.locator('body').evaluate(() => innerWidth);
  assert.ok(box.x >= 0 && box.x + box.width <= width + 1, `${round}: picker overflows viewport`);
}
