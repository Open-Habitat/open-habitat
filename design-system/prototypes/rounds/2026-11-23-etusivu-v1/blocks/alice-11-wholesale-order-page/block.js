// Alice · 16:50 · Wholesale order page. Ported from round 6 (2026-11-22-etusivu-kierros-6), content unchanged.
// The block contract is in ../../BLOCKS.md.
import { esc, you, tool, turn, drafts, screen, view } from '../../engine/kit.mjs';

// ---------- This block's own views ----------
const ORDER_ROWS = [['Tea towel, indigo', 9.5], ['Napkins, set of 4', 16], ['Linen tote', 12.5], ['Apron, rust', 22]];
const orderPageMock = () => `<div class="br"><p class="br-url"><span class="br-lock" aria-hidden="true"></span>wholesale.example.org<i class="live">Live</i></p><div class="op" data-op><p class="op-h"><b>Example Studio · Wholesale</b><span>Signed in as Corner Books</span></p>${ORDER_ROWS.map(([n, p], k) => `<div class="op-row" data-k="${k}" data-p="${p}"><span>${esc(n)}</span><small>€${p.toFixed(2)}</small><span class="op-q"><button type="button" class="op-b" data-d="-1" aria-label="One less ${esc(n)}">−</button><output>${k === 0 ? 10 : k === 2 ? 6 : 0}</output><button type="button" class="op-b" data-d="1" aria-label="One more ${esc(n)}">+</button></span></div>`).join('')}<p class="op-tot"><span>Order total</span><b class="op-sum">€170.00</b></p><span class="op-send">Send order to Bob</span></div></div>`;

export default {
  id: 'alice-11-wholesale-order-page',
  kind: 'glimpse',
  day: 'alice',
  s: 'orders',
  at: '16:50',
  ask: 'How did the order page do today?',
  did: 'At noon her agent built a small order page for the shops that buy wholesale: their prices, a code per shop, orders straight into Bob’s order file. It runs in her own account at her own address, and it kept running all afternoon with every tab closed. Three shops have already used it.',
  screen: () => screen('Wholesale order page', you('11:40', 'Bob says the shops still phone in their orders. Make a simple order page for our wholesale shops: their prices, a code for each shop, and the orders go into Bob’s order file.') + turn({ tools: [
        tool('read', 'wholesale/prices-2026.csv', '64 products · 12 shops'),
        tool('write', 'apps/wholesale/app.py', '182 lines · Python and SQLite'),
        tool('bash', 'systemctl --user enable --now wholesale', 'wholesale.service: active (running)\nkeeps running when you sign out'),
        tool('publish', 'wholesale.example.org → apps/wholesale', 'https://wholesale.example.org · certificate ok'),
      ], time: '32 min 50 s', reply: 'It is live at **wholesale.example.org**. Each shop signs in with its own code, and orders go into *orders/wholesale.csv*, where Bob’s agent reads them. Send the twelve shops their codes?' }) + you('12:12', 'Yes, from my mailbox.') + turn({ reply: 'Sent, one message per shop.', extra: drafts([['sent', '12 shops', 'Order online from today', 'Hi, from today you can order at wholesale.example.org with the code…']]) }) + you('16:48', 'How did the order page do today?') + turn({ tools: [
        tool('bash', 'sqlite3 apps/wholesale/orders.db "select shop, items, total from orders where day = today"', 'Corner Books     16 items   €170.00\nHarbour Gifts    19 items   €742.50\nMill Lane Deli    6 items   €373.50'),
      ], time: '2 min 35 s', reply: 'Running since 12:10. **Three shops ordered**, 41 items, €1,286. Bob already has them in *orders/wholesale.csv*.' }), view('wholesale.example.org', orderPageMock(), 'Live')),
};
