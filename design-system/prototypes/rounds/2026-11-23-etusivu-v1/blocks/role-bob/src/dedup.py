"""Customer list cleanup for role-bob: a real fuzzy dedup on a generated register.

python3 dedup.py <out-dir>

Generates Example Studio's invented customer register (web buyers, shops,
hotels; twelve years of sign-ups with the spelling drift such files gather),
then matches it the way the agent in the scene does: normalise, block by
postcode, compare names with rapidfuzz, and merge only when the address or a
company email domain agrees as well. Similar names at different addresses
with a matching email go to ask-bob.csv instead. Writes customers.csv, customers-clean.csv,
ask-bob.csv and dedup.json (the counts the block shows).
"""
import csv, json, random, re, sys
from collections import defaultdict
from rapidfuzz import fuzz

out = sys.argv[1]
rng = random.Random(4100)
FIRST = 'Aino Ben Clara Dan Eeva Felix Greta Hanna Iris Jon Kai Lea Mika Nora Otto Pia Rasmus Saga Tom Ulla Vera Will Ada Bruno Celia Elmo Freya Hugo Ilse Juho Kaisa Leo Maja Niko Olga Paul Rosa Sami Tiia Viggo'.split()
LAST = 'Aalto Berg Carter Dahl Ek Field Grahn Holm Ivers Juhl Koski Lind Mäki Nord Olsen Paasi Quist Rantala Salo Torp Uusi Vik Wahl Ahl Brook Hill Kallio Laine Moss Niemi Park Reed Stone Vale Wood'.split()
SHOPWORD = 'Corner Harbour Linden Willow Birch Maple Copper Blue Door Granary North Mill Station River Cedar Oak Pine Little Loom Old Town Hillside Sea Meadow Fern Ash Rowan Lantern Kettle Thread Needle Stone'.split()
SHOPKIND = 'Books Gifts Deli Florist Gallery Kitchen Interiors Yarns Market Café Hardware Bakery Hotel Guesthouse Tea Room Design Home Store Studio Crafts'.split()
STREETS = 'Mill Lane|Harbour Road|Station Street|Linden Avenue|Church Street|River Walk|North Road|Market Square|Pine Street|Birch Way|Old Town Row|Hill Road|Meadow Lane|Granary Yard|Ferry Road|School Street|Garden Lane|Bridge Street|Lake Road|Forest Way'.split('|')
FREEMAIL = ['mail.example.org', 'post.example.org', 'inbox.example.org']
POST = [f'0{n}' for n in range(6100, 6180, 5)]

def slug(s): return re.sub(r'[^a-z]', '', s.lower())
rows, base, seen = [], [], set()
while len(base) < 3820:
    kind = rng.random()
    street, no, pc = rng.choice(STREETS), rng.randint(1, 80), rng.choice(POST)
    if kind < 0.86:
        f, l = rng.choice(FIRST), rng.choice(LAST)
        name, email = f'{f} {l}', f'{slug(f)}.{slug(l)}{rng.randint(1, 99)}@{rng.choice(FREEMAIL)}'
        orders = rng.choice([1, 1, 1, 2, 2, 3, 4, 6])
    else:
        name = f'{rng.choice(SHOPWORD)} {rng.choice(SHOPKIND)}'
        email = f'orders@{slug(name)}.example.org'
        orders = rng.randint(3, 40)
    if (name, pc) in seen: continue  # one register, one namesake per postcode: real namesakes are what ask-bob.csv is for
    seen.add((name, pc))
    base.append(dict(name=name, address=f'{no} {street}', postcode=pc, email=email, orders=orders, year=rng.randint(2014, 2026)))
# the shop the scene is about, written three ways over the years
base[17] = dict(name='Corner Books', address='12 Mill Lane', postcode='06100', email='orders@cornerbooks.example.org', orders=23, year=2015)
for b in base: rows.append(dict(b))

def variant_name(n):
    r = rng.random()
    if r < .25: return n + ' Ltd'
    if r < .45: return n.replace(' ', '', 1)
    if r < .6: return n.upper()
    if r < .8 and len(n) > 6:  # a typo: two letters swapped
        k = rng.randint(1, len(n) - 3); return n[:k] + n[k + 1] + n[k] + n[k + 2:]
    return n.replace('&', 'and') if '&' in n else n + ' Oy'
def variant_addr(a):
    no, street = a.split(' ', 1)
    r = rng.random()
    if r < .35: return f'{street} {no}'
    if r < .6: return f'{no} {street}'.replace('Lane', 'Ln.').replace('Street', 'St.').replace('Road', 'Rd').replace('Avenue', 'Ave')
    if r < .8: return f'{no}, {street}'
    return a.lower()

dup_src = rng.sample(range(20, 3820), 270)
for k in dup_src:
    b = base[k]
    for _ in range(1 if rng.random() < .85 else 2):
        v = dict(b, name=variant_name(b['name']), address=variant_addr(b['address']), orders=rng.randint(1, max(1, b['orders'] // 2)), year=rng.randint(b['year'], 2026))
        if '@' in v['email'] and v['email'].split('@')[1] in FREEMAIL and rng.random() < .5:
            v['email'] = v['email'].replace('@', '2@')  # a second address of the same person
        rows.append(v)
rows.append(dict(base[17], name='Corner Books Ltd', address='12 Mill Ln.', orders=11, year=2019))
rows.append(dict(base[17], name='Cornerbooks', address='Mill Lane 12', email='info@cornerbooks.example.org', orders=7, year=2023))
# look-alikes: a similar name at another address (a namesake, a second branch, a move?)
for k in rng.sample(range(20, 3820), 80):
    b = base[k]
    rows.append(dict(b, name=variant_name(b['name']) if rng.random() < .5 else b['name'], address=f'{rng.randint(1, 80)} {rng.choice(STREETS)}',
                     email=b['email'].replace('@', '.home@') if b['email'].split('@')[1] in FREEMAIL else b['email'].replace('.example.org', 'shop.example.org'), orders=rng.randint(1, 5), year=rng.randint(2016, 2026)))
rng.shuffle(rows)
for i, r in enumerate(rows): r['id'] = f'C{i + 1:05d}'
F = ['id', 'name', 'address', 'postcode', 'email', 'orders', 'year']
with open(f'{out}/customers.csv', 'w', newline='') as fh:
    w = csv.DictWriter(fh, F); w.writeheader(); w.writerows(rows)

# ---------------- the match itself ----------------
ABBR = {'ln': 'lane', 'st': 'street', 'rd': 'road', 'ave': 'avenue'}
def norm_name(n): return re.sub(r'\b(ltd|oy|ab|inc)\b', '', re.sub(r'[^a-z0-9& ]', ' ', n.lower())).replace(' ', '')
def norm_addr(a):
    toks = [ABBR.get(t, t) for t in re.findall(r'[a-z]+|\d+', a.lower())]
    return ' '.join(sorted(toks))
def local(e): return re.sub(r'[^a-z]', '', e.split('@')[0])
def domain(e): d = e.split('@')[1]; return None if d in FREEMAIL else d
parent = list(range(len(rows)))
def find(i):
    while parent[i] != i: parent[i] = parent[parent[i]]; i = parent[i]
    return i
blocks = defaultdict(list)
for i, r in enumerate(rows): blocks[r['postcode']].append(i)
certain, unsure, compared = 0, [], 0
for ids in blocks.values():
    for x in range(len(ids)):
        for y in range(x + 1, len(ids)):
            a, b = rows[ids[x]], rows[ids[y]]
            compared += 1
            s = fuzz.ratio(norm_name(a['name']), norm_name(b['name']))
            if s < 85: continue
            same_addr = norm_addr(a['address']) == norm_addr(b['address'])
            same_dom = domain(a['email']) and domain(a['email']) == domain(b['email'])
            if same_addr or same_dom:
                if find(ids[x]) != find(ids[y]): parent[find(ids[x])] = find(ids[y]); certain += 1
            elif s == 100 or fuzz.partial_ratio(local(a['email']), local(b['email'])) >= 95:
                unsure.append((ids[x], ids[y], round(s)))  # moved, a second branch, or a namesake: Bob knows
clusters = defaultdict(list)
for i in range(len(rows)): clusters[find(i)].append(i)
# a pair is only a question if its rows did not end up in one customer anyway
unsure = [(a, b, s) for a, b, s in unsure if find(a) != find(b)]
clean = []
for members in clusters.values():
    members.sort(key=lambda i: (-rows[i]['orders'], rows[i]['year']))
    keep = dict(rows[members[0]]); keep['orders'] = sum(rows[i]['orders'] for i in members)
    keep['merged_from'] = ' '.join(rows[i]['id'] for i in members[1:])
    clean.append(keep)
with open(f'{out}/customers-clean.csv', 'w', newline='') as fh:
    w = csv.DictWriter(fh, F + ['merged_from']); w.writeheader(); w.writerows(clean)
with open(f'{out}/ask-bob.csv', 'w', newline='') as fh:
    w = csv.writer(fh); w.writerow(['pair', 'score'] + F)
    for k, (a, b, s) in enumerate(unsure, 1):
        w.writerow([k, s] + [rows[a][f] for f in F]); w.writerow([k, s] + [rows[b][f] for f in F])
cb = next(m for m in clusters.values() if any(rows[i]['name'] == 'Cornerbooks' for i in m))
res = {'rows': len(rows), 'compared': compared, 'customers': len(clean), 'rows_merged': len(rows) - len(clean),
       'groups_merged': sum(1 for m in clusters.values() if len(m) > 1), 'unsure_pairs': len(unsure),
       'corner_books': [{k: rows[i][k] for k in F} for i in sorted(cb, key=lambda i: rows[i]['year'])],
       'ask_example': [{k: rows[i][k] for k in F} for i in unsure[0][:2]] + [unsure[0][2]] if unsure else None}
json.dump(res, open(f'{out}/dedup.json', 'w'), indent=1, ensure_ascii=False)
print(f"{res['rows']} rows · {compared} pairs compared in {len(blocks)} postcodes")
print(f"{res['rows_merged']} rows merged into {res['groups_merged']} customers: same name and same address or company email domain")
print(f"{res['unsure_pairs']} unsure: similar name, different address")
print(f"{res['customers']} customers in customers-clean.csv")
print(f"orders before: {sum(r['orders'] for r in rows)} · after: {sum(c['orders'] for c in clean)}")
