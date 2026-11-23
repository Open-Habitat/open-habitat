// Capabilities: The web. Two showpieces, both real: Example Studio's shop
// checked by lychee, pa11y and Lighthouse (the report draws their true
// findings from src/check/findings.json), and a rowing club's site built by
// Hugo from Markdown (club.webp is Chromium's capture of it). assets.mjs makes
// both; NOTES.md has the programs, versions and licences.
// The block contract is in ../../BLOCKS.md.
import { readFileSync } from 'node:fs';
import { esc, you, att, tool, turn, screen, view, image, assets } from '../../engine/kit.mjs';
import { toggles } from '../../engine/views.mjs';

const asset = assets(import.meta.url);
const F = JSON.parse(readFileSync(new URL('./src/check/findings.json', import.meta.url), 'utf8'));

// ---------- Numbers from the real runs ----------
const n = (x) => x.toLocaleString('en-GB');
const mb = (b) => `${(b / 1048576).toFixed(1)} MB`;
const kb = (b) => `${Math.round(b / 1024)} KB`;
const median = (xs) => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
const B = F.before;
const A = F.after;
const slow = B.speed.filter((s) => s.bytes > 1e6);
const quick = B.speed.filter((s) => s.bytes <= 1e6);
const slowAfter = A.speed;
const care = B.links.by_target.find((t) => t.url.includes('/care-guide/'));
const supplier = B.links.by_target.filter((t) => t.url.includes('northside'));
const contrast = B.a11y.issues.find((i) => i.runner === 'htmlcs');
const ratio = contrast.message.match(/ratio of ([\d.]+):1/)[1];
const runners = [...new Set(B.a11y.issues.map((i) => i.runner))];
const lcpSlow = median(slow.map((s) => s.lcp_s));
const lcpFixed = median(slowAfter.map((s) => s.lcp_s));
const lcpQuick = median(quick.map((s) => s.lcp_s));

// ---------- This block's own views ----------
// The check report: what the three programs found, in order of harm, and the
// same checks after the fixes. A toggle (engine data-view) switches the two.
const btn = (bg, r, label) => `<span class="cw-pair"><span class="cw-btn" style="background:${bg}">Checkout</span><small><b>${esc(r)} : 1</b>${label ? ` ${esc(label)}` : ''}</small></span>`;
const row = (k, title, body, by) => `<li class="cw-r cw-${k}"><span class="cw-mk" aria-hidden="true"></span><div><b>${title}</b>${body}<p class="cw-by">${esc(by)}</p></div></li>`;
const bar = (label, val, max, cls, text) => `<p class="cw-bar ${cls}"><span>${esc(label)}</span><i style="--w:${Math.max(2, Math.round((val / max) * 100))}%"></i><em>${esc(text)}</em></p>`;
const reportView = () => `<div class="cw-rep" data-view data-state="found">
<div class="cw-top"><p class="cw-site"><b>shop.example.org</b><span>${n(B.pages)} pages · ${n(B.links.total)} links</span></p>${toggles([['found', 'Found'], ['fixed', 'After the fixes']], 'found')}</div>
<ol class="cw-list cw-found">
${row('err', 'Checkout button too faint to read', `<div class="cw-sw">${btn('#D9805A', ratio, 'today')}${btn('#B65D37', '4.6', 'suggested')}</div><p>White on orange; the rule asks for 4.5 : 1. Every sale goes through this button.</p>`, `${runners.join(' + ')} via pa11y · /basket/`)}
${row('err', `${B.links.dead} dead links`, `<ul class="cw-links"><li><b>${care.pages}</b><code>/care-guide/</code><span>moved; every tea towel page still links the old address</span></li><li><b>${supplier.reduce((t, x) => t + x.pages, 0)}</b><code>northside.example.org/catalogue/2019/…</code><span>the supplier retired its 2019 catalogue</span></li></ul>`, `lychee · ${n(B.links.unique)} distinct addresses`)}
${row('warn', `${slow.length} slow product pages`, `${bar(`${slow.length} pages`, lcpSlow, lcpSlow, 'cw-b-bad', `${lcpSlow} s`)}${bar(`other ${quick.length}`, lcpQuick, lcpSlow, '', `${lcpQuick} s`)}<p>Seconds until the product shows on a phone. Each slow page loads a ${mb(median(slow.map((x) => x.bytes)))} photo.</p>`, `Lighthouse ${F.versions.lighthouse} · simulated phone`)}
</ol>
<ol class="cw-list cw-fixed">
${row('ok', 'Checkout button readable', `<div class="cw-sw">${btn('#B65D37', '4.6', '')}</div><p>The nearest darker orange; the shop still looks like itself.</p>`, `${runners.join(' + ')} via pa11y · ${n(A.a11y.passing)} of ${n(A.a11y.pages)} pages pass`)}
${row('ok', `${A.links.dead} dead links`, `<p>The tea towel pages link the care guide’s new address, the supplier links its current catalogue.</p>`, `lychee · ${n(A.links.total)} links again`)}
${row('ok', `${slowAfter.length} product pages fast again`, `${bar('before', lcpSlow, lcpSlow, 'cw-b-bad', `${lcpSlow} s`)}${bar('now', lcpFixed, lcpSlow, 'cw-b-good', `${lcpFixed} s`)}<p>Photos at 1,200 px: ${mb(median(slow.map((x) => x.bytes)))} → ${kb(median(slowAfter.map((x) => x.bytes)))} a page.</p>`, `Lighthouse ${F.versions.lighthouse} · the same ${slowAfter.length} pages`)}
</ol>
<p class="cw-foot cw-found">Everything else passes: ${n(B.a11y.passing)} of ${n(B.a11y.pages)} pages, ${n(B.links.ok)} links.</p>
<p class="cw-foot cw-fixed"><span class="cw-dot" aria-hidden="true"></span>Fixed in the shop’s files. The live shop is unchanged until you say yes.</p>
</div>`;

// The club site as Chromium captured it from Hugo's output, in a browser frame.
const siteView = () => `<div class="cw-br"><p class="cw-url"><span class="cw-lock" aria-hidden="true"></span>riverside-rowing-club.example.org</p><div class="cw-scroll" tabindex="0" role="region" aria-label="The club site">${image(asset('club.webp'), 'The Riverside Rowing Club site: a photo from above of an eight on a tree-lined river under the headline “Rowing on the river since 1926” and a “Try a free session” button; this week’s training times; cards for Training and the club’s history; and the news, with Saturday’s win at the Head of the Mill marked new.', 440, 1302)}</div></div>`;

// [n (number in the research list), group, title, program, who, org, ask, result]
const caps = [
  [25, 'web', 'The agent uses a website on your behalf', 'Playwright', 'Bob', 'Example Studio', 'The courier only offers invoices one by one behind a login. All of last year, please.', 'Twelve months of pages walked through in Bob’s own browser; 212 invoices filed by month, with a sheet of totals.'],
  [34, 'web', 'A website from plain text files', 'Hugo, MkDocs', 'Peggy', 'Riverside Rowing Club', 'Here are the texts, the training times and forty photos. A new site, please.', 'A new site to look at the same morning; adding a regatta result is one sentence to the agent.'],
  [35, 'web', 'A website checked: dead links, slow pages, accessibility', 'lychee, Lighthouse, Pa11y', 'Alice', 'Example Studio', 'I think the web shop has rotted in places.', `${n(B.pages)} pages and ${n(B.links.total)} links checked: ${B.links.dead} dead links, ${slow.length} pages with 4 MB photos, and a checkout button too faint to read. All three fixed and checked again before anything goes live.`],
  [44, 'web', 'A website kept exactly as it is today', 'monolith, Playwright', 'Alice', 'Example Studio', 'Before the shop moves platform, keep the old one.', 'Every page saved as it looked, browsable offline.'],
];
const capOf = Object.fromEntries(caps.map((c) => [c[0], c]));
const capScreen = (k, title, body, v) => screen(title, body, v, capOf[k][5]);

const sitemapUrls = '$(curl -s https://shop.example.org/sitemap.xml | grep -o \'https://[^<]*\')';

export default {
  id: 'caps-web',
  kind: 'caps',
  group: { id: 'web', name: 'The web', line: 'Ask whether your site still works and get the true answer, fixed. Hand over a folder of texts and get a site you can keep up in a sentence.' },
  caps,
  // Shown in full, in this order: a screen with the work and the result.
  show: [35, 34],
  full: {
    35: () => capScreen(35, 'Shop check', you('16:10', 'I think the web shop has rotted in places. Can you go over it? Links, speed, and whether everyone can actually use it.') + turn({
        thoughts: ['Three programs, one each: lychee for links, Lighthouse for speed, pa11y for accessibility. The sitemap lists every page.'],
        tools: [
          tool('bash', `lychee --format json -o links.json ${sitemapUrls}`, `🔍 ${n(B.links.total)} Total · ✅ ${n(B.links.ok)} OK · 🚫 ${B.links.dead} Errors\n${care.pages} × [404] https://shop.example.org/care-guide/\n${supplier.length} × [404] https://northside.example.org/catalogue/2019/…`),
          tool('bash', 'npx pa11y-ci --sitemap https://shop.example.org/sitemap.xml', `✘ ${B.a11y.passing}/${B.a11y.pages} URLs passed\nhttps://shop.example.org/basket/\n • ${contrast.message.replace(/ Recommendation:.*$/, '')}\n   (html > body > main > a) <a class="btn btn-checkout" href="/checkout/">Checkout</a>`),
          tool('bash', 'for u in $(grep -o \'https://[^<]*/\\(prints\\|totes\\|tea-towels\\|napkins\\|cushions\\|aprons\\)/[^<]*\' sitemap.xml); do npx lighthouse "$u" --only-categories=performance --output=json --quiet; done', `${B.speed.length} product pages\n${slow.length} pages over 4 MB · largest paint ${lcpSlow} s\n${quick.length} pages around ${kb(median(quick.map((s) => s.bytes)))} · largest paint ${lcpQuick} s`),
        ],
        time: '9 min 40 s',
        reply: `Three things, in order of harm. The **checkout button** is white on orange at ${ratio} : 1, too faint for many people to read. **${B.links.dead} links are dead**: ${care.pages} from the care guide’s move, ${supplier.length} to the supplier’s retired catalogue. **${slow.length} product pages** carry 4 MB photos and take ${lcpSlow} s to show on a phone. I can fix all three in the shop’s files and check again; the live shop stays as it is until you say yes.`,
      }) + you('16:24', 'Fix them, and show me before anything goes live.') + turn({
        tools: [
          tool('edit', 'theme/shop.css', '.btn-checkout { background: #D9805A → #B65D37 }', '1 line'),
          tool('bash', 'grep -rl \'href="/care-guide/"\' content | xargs sed -i \'s|/care-guide/|/guides/linen-care/|\'', `${care.pages} files changed`),
          tool('edit', 'content/**/*.html', `${supplier.length} links → https://northside.example.org/catalogue/2026/`, `${supplier.length} files`),
          tool('bash', 'for f in photos/*-original.jpg; do magick "$f" -resize 1200 -quality 78 "${f%-original.jpg}.jpg"; done', `${slowAfter.length} pages now use the 1,200 px photo`),
          tool('bash', 'lychee … && npx pa11y-ci … && npx lighthouse … (the same three checks)', `🚫 ${A.links.dead} Errors of ${n(A.links.total)}\n✔ ${A.a11y.passing}/${A.a11y.pages} URLs passed\n${slowAfter.length} pages · largest paint ${lcpFixed} s`),
        ],
        time: '6 min 15 s',
        reply: `All three fixed, and the same three programs agree: no dead links, every page passes, and the ${slowAfter.length} slow pages show in ${lcpFixed} s. The report beside us has both. Say yes and I publish.`,
      }), view('shop-check.html', reportView())),
    34: () => capScreen(34, 'New club website', you('10:00', 'Here are the texts, the training times and forty photos. A new site, please, one that looks like us and that I can keep up without learning anything.', att('site-texts/', '9 texts · 40 photos')) + turn({
        thoughts: ['Plain Markdown files she can read, built by Hugo. The training times go in one data file, so a change is one line.'],
        tools: [
          tool('bash', 'hugo version || curl -sL https://github.com/gohugoio/hugo/releases/download/v0.170.1/hugo_extended_0.170.1_linux-arm64.tar.gz | tar -xz -C ~/.local/bin hugo', `bash: hugo: command not found\nhugo v${F.versions.hugo.replace(/^v/, '').split('-')[0]}+extended linux/arm64`),
          tool('write', 'club/content/', 'home, training, history, join and three news items, from site-texts/', 'new · 7 files'),
          tool('write', 'club/data/sessions.yaml', 'Tuesday 18:00 · Thursday 18:00 · Saturday 09:00', 'new · 9 lines'),
          tool('write', 'club/layouts/index.html', 'photo header, this week on the water, two cards, the news', 'new · 24 lines'),
          tool('bash', 'hugo --minify', 'Pages            │  8\nProcessed images │  3\nTotal in 284 ms'),
        ],
        time: '18 min 20 s',
        reply: 'A first version is up on a preview only you can see. The eight from above leads the front page, the 1940s regatta photo heads the history card, and the other photos wait in photos/ for a gallery page whenever you want one. The training times live in one small file.',
      }) + you('10:31', 'Lovely. Add Saturday: our women’s four won at the Head of the Mill. Then put it live.') + turn({
        tools: [
          tool('write', 'club/content/news/2026-11-21-head-of-the-mill.md', 'Women’s four first at the Head of the Mill', 'new · 5 lines'),
          tool('bash', 'hugo --minify', 'Pages │ 9 · Total in 291 ms'),
          tool('publish', 'riverside-rowing-club.example.org', 'https://riverside-rowing-club.example.org · certificate ok'),
        ],
        time: '50 s',
        reply: 'Live, with Saturday’s win at the top of the news. The next result works the same way: one sentence to me.',
      }), view('riverside-rowing-club.example.org', siteView(), 'Live')),
  },
  // Shown in someone's day above: [person, conversation]; the page draws a line that points there.
  inDay: {},
};
