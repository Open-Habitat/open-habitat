// Alice · 09:44 · Shipping banner.
// The history quoted here and the two pictures of the shop page come from one
// real Git repository that assets.mjs builds; see NOTES.md.
// The block contract is in ../../BLOCKS.md.
import { you, tool, turn, diff, screen, view, assets, esc } from '../../engine/kit.mjs';

const asset = assets(import.meta.url);

// git's own output from the repository assets.mjs builds (paste again if it changes).
const LOG = `commit ecdefe09dc7a0a689baa59bf3ae9112d344fc1da
Author: Bob (agent) <bob@example.org>
Date:   Tue Nov 17 16:42:00 2026 +0200

    Add free-shipping banner for Northside week

    Bob: Northside pays the postage on orders over €30
    until Sunday 22 Nov. Take it down on Monday.`;
const SHOWN = `--- a/site/_includes/banner.html
+++ b/site/_includes/banner.html
@@ -0,0 +1,4 @@
+<p class="banner">
+  {% include truck.svg %}
+  Free shipping over €30
+</p>`;
const COMMIT = `[main 30690bc] Banner: free shipping ends on Sunday 22 November
 1 file changed, 1 insertion(+), 1 deletion(-)`;
const PUSH = `To gitea.example.org:studio/shop.git
   ecdefe0..30690bc  main -> main`;

// The site's history, newest first: [hash, who, colour class, when, what, the person's words].
const HISTORY = [
  ['30690bc', 'Alice', 'a', 'Today 09:49', 'Banner: free shipping ends on Sunday 22 November', 'Add “until Sunday” to it.', 'now'],
  ['ecdefe0', 'Bob', 'b', 'Tue 17 Nov 16:42', 'Add free-shipping banner for Northside week', 'Northside pays the postage on orders over €30 until Sunday 22 Nov. Take it down on Monday.', 'hit'],
  ['78712af', 'Carol', 'c', 'Thu 12 Nov 14:05', 'Front page: lead with the winter prints', ''],
  ['991a3e9', 'Carol', 'c', 'Fri 9 Oct 11:20', 'Shop front page: four products from the studio', ''],
];
const siteView = () => `<div class="sb">
  <figure class="sb-site">
    <p class="sb-bar"><span class="sb-dots" aria-hidden="true"><i></i><i></i><i></i></span><span class="sb-url">example.org/shop</span><span class="sb-live">Published 09:50</span></p>
    <picture>
      <source media="(max-width: 600px)" srcset="${asset('shop-narrow.webp')}" width="720" height="1120">
      <img src="${asset('shop-wide.webp')}" width="1200" height="1000" loading="lazy" decoding="async" alt="Example Studio’s shop page. The banner across the top now reads: Free shipping over €30 until Sunday 22 November.">
    </picture>
  </figure>
  <section class="sb-hist" aria-label="The site’s history">
    <p class="sb-h"><b>Every change to the site</b><span>who, when, and why</span></p>
    <ol>${HISTORY.map(([hash, who, c, when, what, why, mark = '']) => `<li${mark ? ` class="sb-${mark}"` : ''}><i class="sb-who sb-${c}" aria-hidden="true">${who[0]}</i><p class="sb-l"><b>${who}’s agent</b><time>${when}</time><code>${hash}</code></p><p class="sb-what">${esc(what)}</p>${why ? `<p class="sb-why"><span>${who}:</span> “${esc(why)}”</p>` : ''}</li>`).join('')}</ol>
  </section>
</div>`;

export default {
  id: 'alice-05-shipping-banner',
  kind: 'glimpse',
  day: 'alice',
  s: 'banner',
  at: '09:44',
  ask: 'Our site says “Free shipping over €30”. Who put that there, and why?',
  did: 'Nobody remembers, but the site does: every change to it is kept with its author, its time and the reason in the person’s own words. It was Bob’s agent on Tuesday, because Bob asked. She has the end date added, looks at the page, and it goes public only when she says yes.',
  screen: () => screen('Shipping banner',
    you('09:43', 'Our site says “Free shipping over €30”. Who put that there, and why?') +
    turn({
      thoughts: ['The site is a Git repository, so the line has an author. Searching the history for the change that added it.'],
      tools: [
        tool('bash', 'git log -S "Free shipping" --reverse -- site/', LOG),
        tool('bash', 'git show ecdefe0 -- site/_includes/banner.html', SHOWN),
      ],
      time: '38 s',
      reply: '**Bob’s agent added it on Tuesday at 16:42**, because Bob asked for it. His words in the change: “Northside pays the postage on orders over €30 until Sunday 22 Nov. Take it down on Monday.”\n\nThe banner itself doesn’t say that it ends.',
    }) +
    you('09:47', 'Add “until Sunday” to it.') +
    turn({
      tools: [
        tool('edit', 'site/_includes/banner.html', '-  Free shipping over €30\n+  Free shipping over €30 until Sunday 22 November', '+1 −1'),
        tool('bash', 'git diff --stat', ' site/_includes/banner.html | 2 +-\n 1 file changed, 1 insertion(+), 1 deletion(-)'),
      ],
      time: '46 s',
      reply: 'Changed, with the full date so it still reads right at the weekend. The page beside this shows it. Only you see it so far: publishing pushes the change to the shop’s repository, and the site updates from there. Publish?',
      extra: diff('site/_includes/banner.html', ['- Free shipping over €30', '+ Free shipping over €30 until Sunday 22 November']),
    }) +
    you('09:49', 'Yes.') +
    turn({
      tools: [
        tool('bash', 'git commit -am "Banner: free shipping ends on Sunday 22 November"', COMMIT),
        tool('bash', 'git push origin main', PUSH),
      ],
      time: '21 s',
      reply: 'Published. The history now says who asked for the end date too, in your words.',
    }),
    view('example.org/shop', siteView())),
};
