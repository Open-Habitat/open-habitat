// Alice · 16:50 · Wholesale order page: the small app her agent built at noon,
// still live in the evening, in her own account at the studio's own address.
// The block contract is in ../../BLOCKS.md.
import { esc, you, tool, turn, drafts, screen, view, image, assets } from '../../engine/kit.mjs';

const asset = assets(import.meta.url);

// The winter range at wholesale prices. The photos are Mitsuba renders (assets.mjs).
const RANGE = [
  ['tea-towel-indigo', 'Tea towel, indigo', '50 × 70 cm', 9.5, 6],
  ['napkins-set-of-4', 'Napkins, set of 4', '40 × 40 cm', 16, 2],
  ['cushion-cover-ochre', 'Cushion cover, ochre', '45 × 45 cm', 19, 2],
  ['table-runner-rust', 'Table runner, rust', '40 × 150 cm', 24, 1],
];
// Today's orders, as orders.db has them (the same rows the 16:48 query prints).
const ORDERS = [
  ['12:41', 'Corner Books', 'CB', 14, 178],
  ['14:05', 'Harbour Gifts', 'HG', 46, 646],
  ['15:52', 'Mill Lane Deli', 'ML', 16, 288],
];
const eur = (n) => `€${n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const itemsIn = RANGE.reduce((a, r) => a + r[4], 0);
const totalIn = RANGE.reduce((a, r) => a + r[3] * r[4], 0);

const shopPage = () => `<div class="ws-shop">
  <header class="ws-head"><p class="ws-brand"><b>Example Studio</b><span>Hand-printed linen · Wholesale</span></p><p class="ws-who"><span class="ws-av" aria-hidden="true">CB</span><span>Corner Books<small>Preview with the shop’s code</small></span></p></header>
  <p class="ws-lead"><b>Winter range</b><span>Printed by hand in the studio. Prices per piece, ex VAT.</span></p>
  <ul class="ws-grid">${RANGE.map(([img, name, sub, p, q]) => `<li class="ws-card" data-p="${p}">${image(asset(`${img}.webp`), name, 600, 450, 'ws-ph')}<p class="ws-name"><b>${esc(name)}</b><span>${esc(sub)}</span></p><p class="ws-buy"><span class="ws-price">${eur(p)}</span><span class="ws-q"><button type="button" class="ws-b" data-d="-1" aria-label="One less: ${esc(name)}">−</button><output aria-label="Quantity: ${esc(name)}">${q}</output><button type="button" class="ws-b" data-d="1" aria-label="One more: ${esc(name)}">+</button></span></p></li>`).join('')}</ul>
  <div class="ws-foot"><p class="ws-tot"><span><span class="ws-n">${itemsIn}</span> items</span><b class="ws-sum">${eur(totalIn)}</b></p><span class="ws-place">Place order</span><p class="ws-note">Dispatched from the studio within three working days.</p></div>
</div>`;

const ordersPage = () => `<div class="ws-orders">
  <p class="ws-oh"><b>Orders today</b><span>Thursday · from orders.db</span></p>
  <p class="ws-kpi"><span><b>3</b>shops</span><span><b>76</b>items</span><span><b>${eur(1112)}</b>total</span></p>
  <ul class="ws-ol">${ORDERS.map(([t, shop, ini, n, sum]) => `<li><span class="ws-av" aria-hidden="true">${ini}</span><span class="ws-om"><b>${esc(shop)}</b><small>${t} · ${n} items</small></span><span class="ws-os"><b>${eur(sum)}</b><small>In Bob’s file</small></span></li>`).join('')}</ul>
  <p class="ws-svc"><code>wholesale.service</code> · active since 12:10 · <code>~/apps/wholesale</code></p>
</div>`;

// Alice's own app in a browser frame; the tabs switch the page and its URL.
const orderApp = () => `<div class="ws" data-view data-state="shop">
  <p class="ws-url"><span class="ws-lock" aria-hidden="true"></span><span class="ws-addr" data-label>wholesale.example.org</span><i class="ws-live">Live</i></p>
  <p class="ws-tabs"><button type="button" data-set="shop" aria-pressed="true" data-label="wholesale.example.org">Order page</button><button type="button" data-set="orders" aria-pressed="false" data-label="wholesale.example.org/orders">Orders today <b>3</b></button></p>
  <div class="ws-pane ws-pane-shop">${shopPage()}</div>
  <div class="ws-pane ws-pane-orders">${ordersPage()}</div>
</div>`;

const UNIT = `[Unit]
Description=Example Studio wholesale order page

[Service]
WorkingDirectory=%h/apps/wholesale
ExecStart=/usr/bin/python3 app.py --port 8411
Restart=on-failure

[Install]
WantedBy=default.target`;

const APP = `# One page for the wholesale shops: a code per shop,
# orders kept in SQLite and added to Bob's order file.
import csv, os, sqlite3
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler

DB = sqlite3.connect("orders.db", check_same_thread=False)
BOB = os.path.expanduser("~/shared/orders/wholesale.csv")
…
def place_order(shop, lines):
    total = sum(PRICES[sku] * n for sku, n in lines)
    with DB:
        DB.execute("insert into orders (shop, items, total, at) "
                   "values (?, ?, ?, datetime('now', 'localtime'))", …)
    with open(BOB, "a", newline="") as f:
        csv.writer(f).writerows(…)`;

export default {
  id: 'alice-11-wholesale-order-page',
  kind: 'glimpse',
  day: 'alice',
  s: 'orders',
  at: '16:50',
  ask: 'How did the order page do today?',
  did: 'At noon her agent built the wholesale shops an order page of their own: the winter range at their prices, a code for each shop, every order straight into Bob’s order file. It is a small app in her own account at the studio’s own address, and it took orders all afternoon with every tab closed.',
  screen: () => screen('Wholesale order page',
    you('11:40', 'Bob says the shops still phone in their orders. Make a simple order page for our wholesale shops: their prices, a code for each shop, and the orders go into Bob’s order file.') +
    turn({
      thoughts: ['A small app in her own account: Python’s web server and SQLite, nothing to install, run as her user service so it stays up after she signs out.'],
      tools: [
        tool('read', 'wholesale/prices-winter.csv', 'sku,product,size,wholesale_eur\nTT-IND,"Tea towel, indigo",50×70 cm,9.50\nNP-SET4,"Napkins, set of 4",40×40 cm,16.00\nCC-OCH,"Cushion cover, ochre",45×45 cm,19.00\nTR-RUS,"Table runner, rust",40×150 cm,24.00', '4 products'),
        tool('read', 'wholesale/shops.csv', 'shop,contact,email\nCorner Books,Sam,orders@cornerbooks.example.org\nHarbour Gifts,Noor,shop@harbourgifts.example.org\n… 12 shops', '12 shops'),
        tool('write', 'apps/wholesale/app.py', APP, 'new · 186 lines'),
        tool('bash', 'mogrify -path apps/wholesale/static -format webp -resize 600x450^ -gravity center -extent 600x450 shared/photos/winter/*.png', 'tea-towel-indigo.webp  napkins-set-of-4.webp\ncushion-cover-ochre.webp  table-runner-rust.webp'),
        tool('bash', 'python3 apps/wholesale/app.py --new-codes shops.csv', '12 codes written to apps/wholesale/codes.csv\nCorner Books   CB-7Q2K\nHarbour Gifts  HG-4M9T\n…'),
        tool('write', '~/.config/systemd/user/wholesale.service', UNIT, 'new · 11 lines'),
        tool('bash', 'systemctl --user enable --now wholesale && curl -s localhost:8411/health', 'Created symlink ~/.config/systemd/user/default.target.wants/wholesale.service\nok · 4 products · 12 shops · orders.db ready'),
        tool('bash', 'publish wholesale.example.org 8411', 'https://wholesale.example.org → alice:8411\ncertificate ok · 200 OK'),
      ],
      time: '29 min 40 s',
      reply: 'It is live at **wholesale.example.org**: the winter range at wholesale prices, a code for each of the twelve shops, and every order goes into *orders.db* and onto Bob’s *orders/wholesale.csv*. It runs as a service in your account, so it keeps going when you close this tab. A message with each shop’s code is ready. Send them?',
      extra: drafts([['ready', '12 shops, one message each', 'Order online from today', 'Hi Sam, from today Corner Books can order at wholesale.example.org with the code CB-7Q2K…']]),
    }) +
    you('12:12', 'Yes, send them from my mailbox.') +
    turn({
      tools: [tool('mail', 'send 12 drafts · from alice@example.org', '12 sent · 0 bounced')],
      time: '38 s',
      reply: 'Sent, one message per shop.',
    }) +
    you('16:48', 'How did the order page do today?') +
    turn({
      tools: [
        tool('bash', 'systemctl --user status wholesale --no-pager | head -3', '● wholesale.service - Example Studio wholesale order page\n     Loaded: loaded (~/.config/systemd/user/wholesale.service; enabled)\n     Active: active (running) since Thu 12:10:04; 4h 38min ago'),
        tool('bash', 'sqlite3 -column apps/wholesale/orders.db "select time(at), shop, items, total from orders where date(at) = date(\'now\')"', '12:41:17  Corner Books    14   178.00\n14:05:52  Harbour Gifts   46   646.00\n15:52:09  Mill Lane Deli  16   288.00'),
        tool('bash', 'grep -c "^2026-11-26" shared/orders/wholesale.csv', '3'),
      ],
      time: '1 min 12 s',
      reply: 'Up since 12:10 without a restart. **Three shops ordered**: 76 items, €1,112. Harbour Gifts was the biggest at €646, and all three are already in Bob’s *orders/wholesale.csv*. The page is open beside this, with today’s orders one tab over.',
    }),
    view('wholesale.example.org', orderApp(), 'Live')),
};
