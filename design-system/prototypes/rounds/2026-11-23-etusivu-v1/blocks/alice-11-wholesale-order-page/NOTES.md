# alice-11-wholesale-order-page

Alice · 16:50 · Wholesale order page. Her agent built the page at noon, and in
the evening it is still live in her own account.

## What the reader sees

- **The story (left).** The ask is unchanged ("How did the order page do
  today?"). `did` now says what was built (the winter range at wholesale
  prices, a code per shop, orders into Bob's file) and why it matters: it is
  a small app in her own account, at the studio's own address, and it took
  orders all afternoon with every tab closed.
- **The view: Example Studio's own wholesale page** in a browser frame at
  `wholesale.example.org` (Live). It is a calm, warm linen shop: wordmark,
  "Winter range", four product cards with real rendered photos, a −/+
  stepper on each, a running item count and total, and "Place order" (not
  a button; this is Alice's preview with Corner Books' code). The steppers
  really count (`client.js`). A second tab, **Orders today 3**, uses the
  engine's `data-view`/`data-set` toggle; it also changes the address to
  `/orders`. That tab shows three KPI tiles (3 shops, 76 items, €1,112.00),
  the three orders with the time, item count, sum and "✓ In Bob's file", and
  the line `wholesale.service · active since 12:10 · ~/apps/wholesale`.
- **The work (Show work)** proves it is an app in her account: it reads the
  price list and the shop list, writes `apps/wholesale/app.py` (stdlib HTTP
  server + SQLite, with an honest snippet), makes the product photos into
  WebP with `mogrify`, generates the shop codes, writes
  `~/.config/systemd/user/wholesale.service` (the full unit opens), runs
  `systemctl --user enable --now` plus a health check, and publishes the
  address. At 16:48: `systemctl --user status`, a `sqlite3` query on
  `orders.db` with the three rows, and a count of the lines in Bob's CSV.
- **Nothing goes out without her yes.** The 12:10 reply ends with a draft
  to 12 shops marked READY and the question "Send them?". The send happens
  only after her "Yes, send them from my mailbox" at 12:12.
- The figures agree everywhere: the query rows, the orders tab and the
  reply (3 shops, 76 items, €1,112; Harbour Gifts €646). The sidebar line
  "3 shops ordered" (owned by `alice-day`) still fits.
- The products changed from round 6's tote and apron to a cushion cover and
  a table runner, because those shapes can be rendered convincingly from
  generated meshes. The prices are wholesale: €9.50, €16, €19, €24.

## Assets (`$ETUSIVU_ASSETS/alice-11-wholesale-order-page/`)

| File | Size |
|---|---|
| `tea-towel-indigo.webp` | 600 × 450, ~9 KB |
| `napkins-set-of-4.webp` | 600 × 450, ~9 KB |
| `cushion-cover-ochre.webp` | 600 × 450, ~15 KB |
| `table-runner-rust.webp` | 600 × 450, ~12 KB |

Made by `assets.mjs`:

- **Mitsuba 3.9.1** (pip `mitsuba==3.9.1` in a venv under `TMPDIR`, variant
  `llvm_ad_rgb`; path tracer, 256 spp, 720 × 720). Blender's official Linux
  build is x86-64 only, and the build host is aarch64.
- The linen is procedural (numpy): a plain weave with uneven slubbed
  threads that serves as both colour and bump map, and hand block prints
  (leaf sprigs, suns, chevrons, a dotted border) with uneven inking and
  grain. The meshes are built in the script: a folded towel, four stacked
  napkins in four colours, a puffed cushion with a seam, and a runner
  partly unrolled from its roll. They sit on a warm plaster backdrop with
  one large key light and a cool fill.
- **ImageMagick** `convert`: a 720 × 540 band of each render, resized to
  600 × 450, `-modulate 102,104`, WebP quality 82.
- Rerun: `TMPDIR=<scratch> node blocks/alice-11-wholesale-order-page/assets.mjs`
  (about 1.5 min on 8 cores, plus the pip install the first time).
  `MITSUBA_PY=<python>` reuses an existing environment, and `SPP=` lowers
  the quality for quick tries.

## Sources and licences

No third-party media. The images are this block's own renders. Mitsuba 3 is
BSD-3-Clause, and it is only used as a tool here; nothing of it ships.

## Assumptions about the product (for Jari)

- `publish wholesale.example.org 8411` is a small helper that whoever runs
  the studio's server has installed. It maps a subdomain to a port in the
  user's own account and gets a certificate. Open Habitat does not ship it.
  This is "beyond what ships, never what it cannot do". If a different
  mechanism is preferred (Caddy snippet, a skill), change that one tool row.
- The user service survives sign-out (`systemctl --user` with lingering
  enabled for the account). The thought line and the reply say it stays
  up; the service file and `status` output show it.
- `mail send` is the studio's mail tool, used only after her yes.

## Engine needs

None. The tab and address switch use the engine's existing `data-view` /
`data-set` / `data-label` toggle.
