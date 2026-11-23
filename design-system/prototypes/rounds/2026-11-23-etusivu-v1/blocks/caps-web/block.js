// Capabilities: The web. Ported from round 6 (2026-11-22-etusivu-kierros-6), content unchanged.
// The block contract is in ../../BLOCKS.md.
import { esc, you, att, tool, turn, screen, view } from '../../engine/kit.mjs';

// ---------- This block's own views ----------
const siteCheckMock = () => `<ul class="chk">${[['err', '23 dead links', '18 from one renamed page; 5 to a supplier’s retired pages'], ['warn', '11 slow product pages', 'images of 4 MB each; 280 KB would do'], ['err', 'Checkout button', 'contrast 2.9 : 1, needs 4.5 : 1'], ['ok', '606 pages fine', 'titles, alt text, mobile layout']].map(([k, a, b]) => `<li class="chk-${k}"><b>${esc(a)}</b><span>${esc(b)}</span></li>`).join('')}</ul>`;
const siteMock = (name = 'Riverside Rowing Club', nav = ['Training', 'Regattas', 'Join'], h = 'Rowing on the river since 1926', p = 'Training Tuesdays and Thursdays at 18:00, Saturdays at 9:00. Beginners welcome every first Saturday.') => `<div class="br"><p class="br-url"><span class="br-lock" aria-hidden="true"></span>${esc(name.toLowerCase().replace(/[^a-z]+/g, '-').replace(/-$/, ''))}.example.org</p><div class="site"><p class="site-nav"><b>${esc(name)}</b>${nav.map((n) => `<span>${esc(n)}</span>`).join('')}</p><div class="site-hero" aria-hidden="true"></div><b class="site-h">${esc(h)}</b><p>${esc(p)}</p></div></div>`;

// [n (number in the research list), group, title, program, who, org, ask, result]
const caps = [
  [25, 'web', 'The agent uses a website on your behalf', 'Playwright', 'Bob', 'Example Studio', 'The courier only offers invoices one by one behind a login. All of last year, please.', 'Twelve months of pages walked through in Bob’s own browser; 212 invoices filed by month, with a sheet of totals.'],
  [34, 'web', 'A website from plain text files', 'Hugo, MkDocs', 'Peggy', 'Riverside Rowing Club', 'The texts, the training times and forty photos: a new site, please.', 'A new site to look at by evening; adding next week’s regatta result is one sentence to the agent.'],
  [35, 'web', 'A website checked: dead links, slow pages, accessibility', 'lychee, Lighthouse, Pa11y', 'Alice', 'Example Studio', 'I think the web shop has rotted in places.', '640 pages checked: 23 dead links, eleven pages with 4 MB images, and a checkout button that fails the contrast requirement.'],
  [44, 'web', 'A website kept exactly as it is today', 'monolith, Playwright', 'Alice', 'Example Studio', 'Before the shop moves platform, keep the old one.', 'All 640 pages saved as they looked, browsable offline.'],
];
const capOf = Object.fromEntries(caps.map((c) => [c[0], c]));
const capScreen = (n, title, body, v) => screen(title, body, v, capOf[n][5]);

export default {
  id: 'caps-web',
  kind: 'caps',
  group: { id: 'web', name: "The web", line: "Sites built, checked, kept, and services used on your behalf." },
  caps,
  // Shown in full, in this order: a screen with the work and the result.
  show: [35, 34],
  full: {
    35: () => capScreen(35, 'Shop check', you('16:10', capOf[35][6]) + turn({ tools: [
        tool('bash', 'lychee --base https://shop.example.org .', '640 pages · 23 dead links'),
        tool('bash', 'npx pa11y-ci --sitemap https://shop.example.org/sitemap.xml', '1 contrast failure: checkout button'),
      ], reply: 'Four things, in order of harm: the **checkout button** fails contrast, 23 links are dead (18 from one renamed page), and eleven product pages are slow because of 4 MB images. I can fix the links and the images; publishing waits for your yes.' }), view('check-report', siteCheckMock())),
    34: () => capScreen(34, 'New club website', you('10:00', capOf[34][6], att('site-texts/', '9 texts · 40 photos')) + turn({ tools: [
        tool('bash', 'hugo new site club && …', 'site built from 9 text files'),
        tool('publish', 'riverside-rowing-club.example.org', 'preview published · the old site untouched'),
      ], reply: 'A new site is at the preview address. Adding a regatta result is one sentence to me; I change the text file and the site rebuilds.' }), view('riverside-rowing-club.example.org', siteMock())),
  },
  // Shown in someone's day above: [person, conversation]; the page draws a line that points there.
  inDay: {  },
};
