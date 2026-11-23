// Mock views from round 6 that more than one block draws, or that other views use.
// Shared: a block worker does not edit this file. A block that wants its own
// visual writes it in its own block.js (or replaces it with a real asset);
// the view's CSS is in engine/views.css.
import { esc, FILE_IC } from './kit.mjs';

export const sw = (inner, cls = '', vb = '0 0 320 200') => `<svg class="mk ${cls}" viewBox="${vb}" role="img" aria-hidden="true">${inner}</svg>`;
export const toggles = (opts, cur) => `<p class="tg">${opts.map(([v, l, label]) => `<button type="button" data-set="${v}" aria-pressed="${v === cur}"${label ? ` data-label="${esc(label)}"` : ''}>${esc(l)}</button>`).join('')}</p>`;
export const item = (k, i) => `<span class="it it-${k}" style="--c:${['#b45a33', '#3e5b6e', '#31553a', '#8c6f4e', '#2f4f73'][i % 5]}"></span>`;
export const crest = '<path d="M50 8 86 20v28c0 22-16 36-36 44C30 84 14 70 14 48V20z" fill="#2f4f73"/><path d="M28 58c8-6 14-6 22 0s14 6 22 0" stroke="#e9e1d2" stroke-width="5" fill="none"/><path d="M32 40h36M50 26v28" stroke="#e9e1d2" stroke-width="5"/>';
export const sheetMock = (file, head, rows, foot = '') => `<div class="sheet"><p class="sheet-h">${FILE_IC}<span>${esc(file)}</span></p><table><thead><tr>${head.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>${foot ? `<p class="sheet-n">${esc(foot)}</p>` : ''}</div>`;
