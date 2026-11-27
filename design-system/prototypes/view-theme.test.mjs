// node --test design-system/prototypes/view-theme.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initialTheme } from './lib/view-theme.js';

const at = (search, hash) => ({ search, hash });
const device = (dark) => () => ({ matches: dark });

test('the round\'s own choice wins over Habitat\'s hint and the device', () => {
  assert.equal(initialTheme(undefined, at('?theme=light', '#ah-theme=dark'), device(true)), 'light');
  assert.equal(initialTheme(undefined, at('?theme=contrast', ''), device(false)), 'contrast');
});

test('Habitat\'s hint wins over the device', () => {
  assert.equal(initialTheme(undefined, at('', '#ah-theme=dark'), device(false)), 'dark');
  assert.equal(initialTheme(undefined, at('?v=2', '#x=1&ah-theme=light'), device(true)), 'light');
});

test('without a choice or hint the device decides; unknown values are ignored', () => {
  assert.equal(initialTheme(undefined, at('?theme=sepia', '#ah-theme=dim'), device(true)), 'dark');
  assert.equal(initialTheme(undefined, at('', '#ah-themex=dark'), device(false)), 'light');
  assert.equal(initialTheme(['light'], at('', '#ah-theme=dark'), device(true)), 'light');
});
