// Alice · 14:30 · December newsletter. A message sent while the agent worked,
// 386 recipients counted from the order file with every exclusion reasoned,
// and the letter itself, waiting for her yes. The block contract is in ../../BLOCKS.md.
import { MAIL_IC, you, tool, thought, turn, offer, screen, view, image, assets } from '../../engine/kit.mjs';
const asset = assets(import.meta.url);

// ---------- The view: the letter as it will arrive ----------
// The photos are renders made by assets.mjs (Blender, then ImageMagick).
const product = (file, alt, name, what, price) => `<li class="nl9-item">${image(asset(file), alt, 640, 640)}<span class="nl9-item-t"><b>${name}</b><span>${what}</span></span><span class="nl9-price">${price}</span></li>`;
const letter = () => `<div class="nl9">
  <div class="nl9-env">
    <span class="nl9-env-ic">${MAIL_IC}</span>
    <p class="nl9-env-t"><b>Twelve days of linen</b><span>Example Studio &lt;hello@example.org&gt; · to 386 people</span></p>
    <span class="nl9-state">Draft · not sent</span>
  </div>
  <article class="nl9-mail">
    <header class="nl9-brand"><b>Example Studio</b><span>Linen, printed by hand</span></header>
    <figure class="nl9-hero">${image(asset('winter-prints.webp'), 'Three linen tea towels hanging from wooden pegs: an indigo flower print, a rust arch print and a forest green fern print', 1200, 540)}</figure>
    <div class="nl9-body">
      <p class="nl9-kicker">The winter prints · December 2026</p>
      <h4 class="nl9-h">Twelve days <i>of</i> linen</h4>
      <p class="nl9-p">Three new prints are on the shelves, each cut into a block and pressed by hand in the studio: Flower in indigo, Arch in rust and Fern, our first forest green.</p>
      <ul class="nl9-items">
        ${product('cushion-fern.webp', 'A square linen cushion printed with small forest green fern sprigs', 'Fern', 'Cushion cover', '€38')}
        ${product('cushion-indigo.webp', 'A square linen cushion printed with indigo flowers', 'Flower', 'Cushion cover', '€38')}
      </ul>
      <p class="nl9-gift"><b>A gift can wait under the tree.</b> From 1 December you have 30 days to return it.</p>
      <p class="nl9-cta"><span class="nl9-btn">See the winter prints</span></p>
    </div>
    <footer class="nl9-foot">You get this letter because you bought from us in 2026. <u>Unsubscribe</u></footer>
  </article>
</div>`;

export default {
  id: 'alice-09-december-newsletter',
  kind: 'glimpse',
  day: 'alice',
  s: 'newsletter',
  at: '14:30',
  ask: 'Draft the December newsletter for everyone who bought from us this year.',
  did: 'Three minutes in she remembers the wholesale shops and simply says so. She does not stop it or start over: the agent takes the message on at its next step. It counts the list from the order file, 512 buyers down to 386, with a reason on every name it left out, and builds the letter from the photos Carol’s agent cut out an hour ago. Then it waits. Nothing goes to anyone until Alice says yes.',
  screen: () => screen('December newsletter',
    you('14:05', 'Draft the December newsletter for everyone who bought from us this year.') +
    you('14:08', 'Leave out the wholesale shops, they get their own letter.', '', 'Sent while it worked · taken on board at the next step') +
    turn({
      tools: [
        thought('“Everyone who bought this year” is in the order file, not in last year’s mailing list.'),
        tool('bash', 'python3 newsletter/recipients.py orders/2026.csv', '3,208 orders · 512 buyers in 2026\n−  61 unsubscribed          newsletter/unsubscribed.csv\n−   9 same person twice     address differs only in case\n= 442'),
        thought('Alice, 14:08: leave out the wholesale shops. 56 of the buyers have a wholesale account.'),
        tool('bash', 'python3 newsletter/recipients.py orders/2026.csv --without team/wholesale-accounts.csv', '512 buyers in 2026\n−  61 unsubscribed\n−   9 same person twice\n−  56 wholesale shops        your message, 14:08\n= 386 → newsletter/recipients.csv\n  126 left out, reason on every row'),
        tool('bash', 'ls team/photos/winter/ | wc -l', '312\n104 products in 3 sizes · Carol, today 13:20'),
        tool('write', 'newsletter/2026-12.html', 'Subject: Twelve days of linen\n3 photos from team/photos/winter\nreturns: 30 days from 1 Dec, as agreed this morning\nplain-text part written beside it', 'new · 118 lines'),
        tool('bash', 'python3 newsletter/check.py newsletter/2026-12.html', 'every picture has a description\n4 links, all to example.org, all answer\nunsubscribe link present\nsent: nothing'),
      ],
      time: '22 min 28 s',
      reply: 'The draft is open in the view, for **386 people**. The wholesale shops are out, as you said.\n\n| From *orders/2026.csv* | People |\n|---|---:|\n| Bought in 2026 | 512 |\n| Unsubscribed | −61 |\n| Same person twice | −9 |\n| Wholesale shops | −56 |\n| **Get the letter** | **386** |\n\n**Nothing has been sent.** It goes when you say so.',
      extra: offer('recipients.csv', '386 recipients · 126 left out, each with its reason · 41 KB'),
    }),
    view('2026-12.html', letter())),
};
