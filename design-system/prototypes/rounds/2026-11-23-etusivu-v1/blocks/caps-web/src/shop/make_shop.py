"""Example Studio's web shop as a static site with planted problems, for the site check.

python3 -I make_shop.py <out-dir> [--fixed]

Everything is invented and seeded. The problems are the kind a shop collects
over the years, planted so the real checkers (lychee, Lighthouse, pa11y) have
something true to find:

- the care guide moved from /care-guide/ to /guides/linen-care/, and the 18
  tea towel pages still link the old address;
- 5 pages link to the supplier's 2019 catalogue pages, which it has retired;
- 11 product pages carry their original 4000 px photographs (about 4 MB each)
  where every other page has a 1200 px one;
- the checkout button is white on #D9805A, a contrast of 2.9 : 1.

With --fixed the same shop is written as the agent repaired it: links point
to the care guide's new address and the supplier's current catalogue, every
product page has its 1200 px photograph, and the checkout button takes
#B65D37, the nearest colour HTML_CodeSniffer recommended (4.6 : 1).

Product photographs are not made here: assets.mjs draws one linen swatch per
colour with ImageMagick as photos/<colour>.jpg, <colour>-thumb.jpg and
<colour>-original.jpg; this script only writes HTML, CSS and the sitemap.
"""
import html
import random
import sys
from pathlib import Path

out = Path(sys.argv[1])
fixed = '--fixed' in sys.argv[2:]
rnd = random.Random(1126)

KINDS = [
    ('tea-towels', 'Tea towels', 'Tea towel', 18, 24),
    ('totes', 'Tote bags', 'Tote', 16, 32),
    ('prints', 'Prints', 'Print', 22, 38),
    ('napkins', 'Napkins', 'Napkin set', 12, 28),
    ('cushions', 'Cushion covers', 'Cushion cover', 14, 45),
    ('aprons', 'Aprons', 'Apron', 10, 42),
]
MOTIFS = ['Fern', 'Herring', 'Harbour', 'Birch', 'Rowan', 'Gull', 'Meadow', 'Lichen', 'Tide', 'Juniper',
          'Pebble', 'Heron', 'Clover', 'Kelp', 'Thistle', 'Sloe', 'Willow', 'Moss', 'Barley', 'Flint',
          'Larch', 'Plover']
COLOURS = ['indigo', 'rust', 'moss', 'charcoal', 'ochre', 'sea blue']

CSS = """*{box-sizing:border-box}body{margin:0;font:16px/1.55 system-ui,sans-serif;color:#22201c;background:#fbf8f3}
a{color:#7a3b1d}header,footer{padding:14px 24px;background:#f1ebe1}header nav a{margin-right:16px}
main{max-width:960px;margin:0 auto;padding:24px}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:20px}
.grid img,.product img{width:100%;height:auto;background:#eee6da}.price{font-weight:600}
.btn{display:inline-block;padding:10px 18px;border:0;border-radius:6px;background:#7a3b1d;color:#fff;font:600 16px system-ui;text-decoration:none}
.btn-checkout{background:CHECKOUT}footer{margin-top:40px;font-size:14px}footer a{margin-right:14px}"""


def page(path, title, body):
    nav = ''.join(f'<a href="/{k[0]}/">{k[1]}</a>' for k in KINDS)
    doc = f"""<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{html.escape(title)} · Example Studio</title><link rel="stylesheet" href="/shop.css"></head><body>
<header><a href="/"><b>Example Studio</b></a> <nav>{nav}<a href="/basket/">Basket</a></nav></header>
<main>{body}</main>
<footer><a href="/about/">About the studio</a><a href="/guides/linen-care/">Caring for linen</a><a href="/delivery/">Delivery and returns</a><a href="/contact/">Contact</a></footer>
</body></html>"""
    p = out / path.strip('/') / 'index.html' if path != '/' else out / 'index.html'
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(doc)
    pages.append(path)


pages = []
products = []
for slug, name, single, n, base in KINDS:
    for i in range(n):
        motif = MOTIFS[i % len(MOTIFS)]
        colour = COLOURS[(i * 5 + len(slug)) % len(COLOURS)]
        products.append({'kind': slug, 'kind_name': name, 'slug': f'{motif.lower()}-{single.lower().replace(" ", "-")}-{colour.replace(" ", "-")}',
                         'name': f'{motif} {single.lower()}, {colour}', 'colour': colour.replace(' ', '-'), 'price': base + rnd.choice([0, 0, 4, 6])})

# Planted: eleven of the prints and cushion covers keep the original 4000 px photograph.
heavy = set(p['slug'] for p in rnd.sample([p for p in products if p['kind'] in ('prints', 'cushions')], 11))
# Planted: five pages still link the supplier's retired 2019 catalogue.
supplier = rnd.sample([p for p in products if p['kind'] in ('totes', 'aprons', 'napkins')], 5)
supplier_slugs = {p['slug']: 'https://northside.example.org/catalogue/2026/' if fixed else f'https://northside.example.org/catalogue/2019/{p["slug"].split("-")[0]}-linen.html' for p in supplier}

care = '/guides/linen-care/' if fixed else '/care-guide/'
for p in products:
    img = f'/photos/{p["colour"]}{"-original" if p["slug"] in heavy and not fixed else ""}.jpg'
    extra = ''
    if p['kind'] == 'tea-towels':
        extra += f'<p>Wash at 40 °C, iron damp. <a href="{care}">Read the care guide</a>.</p>'  # planted: renamed page
    if p['slug'] in supplier_slugs:
        extra += f'<p>Woven from <a href="{supplier_slugs[p["slug"]]}">Northside’s heavy linen</a>.</p>'  # planted: retired page
    page(f'/{p["kind"]}/{p["slug"]}/', p['name'].capitalize(), f"""<div class="product"><img src="{img}" alt="{html.escape(p['name'].capitalize())}, hand printed" width="1200" height="1200">
<h1>{html.escape(p['name'].capitalize())}</h1><p class="price">€{p['price']}</p><p>Printed by hand in the studio with water-based inks on {('heavy' if p['kind'] in ('totes', 'aprons') else 'washed')} linen.</p>{extra}
<form action="/basket/" method="get"><input type="hidden" name="add" value="{p['slug']}"><button class="btn" type="submit">Add to basket</button></form></div>""")

for slug, name, single, n, base in KINDS:
    items = ''.join(f'<a href="/{p["kind"]}/{p["slug"]}/"><img src="/photos/{p["colour"]}-thumb.jpg" alt="{html.escape(p["name"].capitalize())}" width="400" height="400" loading="lazy"><span>{html.escape(p["name"].capitalize())}</span> <span class="price">€{p["price"]}</span></a>' for p in products if p['kind'] == slug)
    page(f'/{slug}/', name, f'<h1>{name}</h1><div class="grid">{items}</div>')

page('/', 'Hand-printed linen', '<h1>Hand-printed linen from the studio</h1><p>Tea towels, totes, prints and more, printed by hand in small runs.</p><div class="grid">' + ''.join(f'<a href="/{k[0]}/">{k[1]}</a>' for k in KINDS) + '</div>')
page('/about/', 'About the studio', '<h1>About the studio</h1><p>Example Studio prints linen by hand in a small workshop by the harbour.</p>')
page('/guides/linen-care/', 'Caring for linen', '<h1>Caring for linen</h1><p>Wash at 40 °C with mild soap. Iron while damp. Linen softens with every wash.</p>')
page('/delivery/', 'Delivery and returns', '<h1>Delivery and returns</h1><p>Orders leave the studio within two working days. Returns within 30 days.</p>')
page('/contact/', 'Contact', '<h1>Contact</h1><p>studio@example.org</p>')
page('/basket/', 'Your basket', '<h1>Your basket</h1><p>Fern tea towel, indigo · €24</p><p class="price">Total €24</p><a class="btn btn-checkout" href="/checkout/">Checkout</a>')
page('/checkout/', 'Checkout', '<h1>Checkout</h1><p>Delivery address and payment.</p>')

(out / 'shop.css').write_text(CSS.replace('CHECKOUT', '#B65D37' if fixed else '#D9805A'))
(out / 'sitemap.xml').write_text('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
                                 + ''.join(f'<url><loc>https://shop.example.org{p}</loc></url>\n' for p in pages) + '</urlset>\n')
(out.parent / 'products.tsv').write_text(''.join(f'{p["slug"]}\t{p["kind"]}\t{int(p["slug"] in heavy)}\n' for p in products))
print(f'{len(pages)} pages, {len(products)} products, {len(heavy)} heavy, {len(supplier)} supplier links')
