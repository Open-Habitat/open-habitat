// What this page takes from the landing page v1 round beside it: its kit,
// its story helpers and its blocks (read in place, never copied or edited).
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const ROUND = fileURLToPath(new URL('../2026-11-23-etusivu-v1/', import.meta.url));
const k = await import(pathToFileURL(`${ROUND}engine/kit.mjs`).href);
export const { esc, inline, md, you, att, tool, thought, turn, reply, screen, view, offer, workers, drafts, diff, mark, ICONS, USED_ASSETS } = k;

// A block's default export, and its block.css / client.js if it has them.
export const SHOWN = new Set();
export async function block(id) {
  const mod = (await import(pathToFileURL(`${ROUND}blocks/${id}/block.js`).href)).default;
  if (mod.id !== id) throw new Error(`blocks/${id}: id is ${mod.id}`);
  return mod;
}
export const blockFile = (id, f) => {
  const p = `${ROUND}blocks/${id}/${f}`;
  return existsSync(p) ? p : null;
};
// Wrap a block's HTML so its namespaced CSS applies, and remember it was shown.
export const wrap = (id, html, tag = 'div', cls = '') => {
  SHOWN.add(id);
  return `<${tag} class="blk${cls ? ` ${cls}` : ''}" data-block="${id}">${html}</${tag}>`;
};
