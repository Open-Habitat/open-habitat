"""Thursday's delivery round for role-bob: a real route on OpenStreetMap roads.

python3 route.py <osm.json> <out-dir>

<osm.json> is an Overpass `out geom` dump (assets.mjs fetches it). The script
builds the drivable road graph (oneways respected), places the twenty invented
stops on it, measures every stop-to-stop drive with Dijkstra, solves the round
with OR-Tools (bakery first, three time windows, four minutes per stop), and
draws the map with matplotlib. Writes route.json and route-map.png.
"""
import json, math, random, sys
from datetime import datetime, timedelta
import networkx as nx
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import Polygon, Circle, FancyBboxPatch
from ortools.constraint_solver import pywrapcp, routing_enums_pb2

src, out = sys.argv[1], sys.argv[2]
els = json.load(open(src))['elements']
LAT0 = 60.395
KX, KY = 111320 * math.cos(math.radians(LAT0)), 110540
xy = lambda p: (p['lon'] * KX, p['lat'] * KY)

SPEED = {'motorway': 90, 'motorway_link': 50, 'trunk': 70, 'primary': 60, 'primary_link': 40, 'secondary': 50,
         'secondary_link': 35, 'tertiary': 40, 'tertiary_link': 30, 'unclassified': 40, 'residential': 30, 'living_street': 15}
G = nx.DiGraph()
coord = {}
roads, water, green, built = [], [], [], []
for e in els:
    t = e.get('tags', {})
    if e['type'] == 'way' and 'geometry' in e:
        pts = [xy(p) for p in e['geometry']]
        hw = t.get('highway')
        if hw:
            roads.append((hw, pts))
            if hw in SPEED:
                ow = t.get('oneway', 'no')
                for a, b, pa, pb in zip(e['nodes'], e['nodes'][1:], pts, pts[1:]):
                    coord[a], coord[b] = pa, pb
                    m = math.dist(pa, pb)
                    s = SPEED[hw] / 3.6
                    if ow != '-1': G.add_edge(a, b, m=m, s=m / s)
                    if ow not in ('yes', '1', '-1') and not hw.startswith('motorway'): G.add_edge(b, a, m=m, s=m / s)
                    if ow == '-1': G.add_edge(b, a, m=m, s=m / s)
        elif 'building' in t: built.append(pts)
        elif t.get('natural') == 'water' or t.get('waterway') == 'riverbank': water.append(pts)
        elif t.get('landuse') in ('forest', 'grass', 'meadow') or t.get('leisure') in ('park', 'pitch', 'golf_course') or t.get('natural') in ('wood', 'wetland'): green.append(pts)
    elif e['type'] == 'relation' and t.get('natural') == 'water':
        # join outer member ways into rings
        segs = [[xy(p) for p in m['geometry']] for m in e['members'] if m.get('role') == 'outer' and 'geometry' in m]
        while segs:
            ring = segs.pop(0)
            grown = True
            while grown and math.dist(ring[0], ring[-1]) > 0.5:
                grown = False
                for i, s in enumerate(segs):
                    if math.dist(ring[-1], s[0]) < 0.5: ring += s[1:]
                    elif math.dist(ring[-1], s[-1]) < 0.5: ring += s[::-1][1:]
                    else: continue
                    segs.pop(i); grown = True; break
            water.append(ring)

G = G.subgraph(max(nx.strongly_connected_components(G), key=len)).copy()
print(f'road graph: {G.number_of_nodes()} nodes, {G.number_of_edges()} edges')

# ---- the stops: invented names on real roads, placed by a fixed seed ----
STUDIO = 'Example Studio'
STOPS = ['Old Town Bakery', 'Corner Books', 'Harbour Gifts', 'Mill Lane Deli', 'Harbour Hotel', 'Riverside Café',
         'Linden Florist', 'Blue Door Gallery', 'Hillside Care Home', 'Pine Street Kitchen', 'Station Kiosk',
         'Little Loom Yarns', 'Granary Market', 'Maple Interiors', 'Willow Day Nursery', 'Copper Kettle Tea Room',
         'Cedar Guesthouse', 'Oak & Ash Furniture', 'Northside Hardware', 'Sauna Lodge']
WINDOWS = {'Old Town Bakery': (0, 20), 'Granary Market': (0, 60), 'Harbour Hotel': (0, 90)}  # minutes after 11:00: deliver before
SERVICE = 4
eligible = [n for n in G.nodes if any(G.edges[n, v].get('m') for v in G.successors(n))]
by_class = {}
for hw, pts in roads: pass
rng = random.Random(1911)
cx, cy = 25.664 * KX, 60.3935 * KY  # town centre
def near(p, r): return math.dist(coord[p], (cx, cy)) < r
studio = min(eligible, key=lambda n: math.dist(coord[n], (cx - 700, cy - 500)))
cands = [n for n in eligible if near(n, 3600) and G.degree(n) >= 4]
rng.shuffle(cands)
picked = []
for n in cands:
    if all(math.dist(coord[n], coord[p]) > 520 for p in picked + [studio]):
        picked.append(n)
    if len(picked) == len(STOPS): break
# the bakery sits in the old town, near the centre
picked.sort(key=lambda n: math.dist(coord[n], (cx - 150, cy - 50)))
nodes = [studio] + picked

# ---- drive matrix ----
M = [[0] * len(nodes) for _ in nodes]; T = [[0] * len(nodes) for _ in nodes]; P = {}
for i, a in enumerate(nodes):
    dist, paths = nx.single_source_dijkstra(G, a, weight='m')
    for j, b in enumerate(nodes):
        if i == j: continue
        p = paths[b]
        P[i, j] = p
        M[i][j] = round(sum(G.edges[u, v]['m'] for u, v in zip(p, p[1:])))
        T[i][j] = round(sum(G.edges[u, v]['s'] for u, v in zip(p, p[1:])) / 60, 1)

n = len(nodes)
mgr = pywrapcp.RoutingIndexManager(n, 1, 0)
rt = pywrapcp.RoutingModel(mgr)
dcb = rt.RegisterTransitCallback(lambda a, b: M[mgr.IndexToNode(a)][mgr.IndexToNode(b)])
rt.SetArcCostEvaluatorOfAllVehicles(dcb)
tcb = rt.RegisterTransitCallback(lambda a, b: int(round(T[mgr.IndexToNode(a)][mgr.IndexToNode(b)] + (SERVICE if mgr.IndexToNode(a) else 0))))
rt.AddDimension(tcb, 60, 300, True, 'time')
tdim = rt.GetDimensionOrDie('time')
for k, name in enumerate(STOPS, start=1):
    if name in WINDOWS: tdim.CumulVar(mgr.NodeToIndex(k)).SetRange(*WINDOWS[name])
rt.solver().Add(rt.NextVar(rt.Start(0)) == mgr.NodeToIndex(1))  # the bakery first
prm = pywrapcp.DefaultRoutingSearchParameters()
prm.first_solution_strategy = routing_enums_pb2.FirstSolutionStrategy.PARALLEL_CHEAPEST_INSERTION
prm.local_search_metaheuristic = routing_enums_pb2.LocalSearchMetaheuristic.GUIDED_LOCAL_SEARCH
prm.time_limit.seconds = 20
sol = None
for fs in ('PATH_CHEAPEST_ARC', 'PARALLEL_CHEAPEST_INSERTION', 'LOCAL_CHEAPEST_INSERTION', 'SAVINGS'):
    prm.first_solution_strategy = getattr(routing_enums_pb2.FirstSolutionStrategy, fs)
    sol = rt.SolveWithParameters(prm)
    if sol: break
if sol is None: sys.exit(f"no solution; status {rt.status()}; T from studio {T[0]}")
order, idx = [], rt.Start(0)
while not rt.IsEnd(idx):
    order.append(mgr.IndexToNode(idx)); idx = sol.Value(rt.NextVar(idx))
order.append(0)
km = sum(M[a][b] for a, b in zip(order, order[1:])) / 1000
# the same stops in the order they stand in the order list (bakery first)
listed = list(range(n)) + [0]
km_list = sum(M[a][b] for a, b in zip(listed, listed[1:])) / 1000
# the way one drives by eye: bakery first, then always the nearest stop not yet visited
nn, left = [0, 1], set(range(2, n))
while left:
    nxt = min(left, key=lambda k: M[nn[-1]][k]); nn.append(nxt); left.remove(nxt)
nn.append(0)
km_nearest = sum(M[a][b] for a, b in zip(nn, nn[1:])) / 1000

start = datetime(2026, 11, 19, 11, 0)
t, legs = 0.0, []
for a, b in zip(order, order[1:]):
    t += T[a][b] + (SERVICE if a else 0)
    if b and STOPS[b - 1] in WINDOWS: t = max(t, WINDOWS[STOPS[b - 1]][0])  # wait for the window to open
    if b: legs.append({'n': len(legs) + 1, 'name': STOPS[b - 1], 'min': round(t), 'eta': (start + timedelta(minutes=t)).strftime('%H:%M'),
                       'window': WINDOWS.get(STOPS[b - 1])})
back = (start + timedelta(minutes=t)).strftime('%H:%M')
drive = sum(T[a][b] for a, b in zip(order, order[1:]))
ok = all(not l['window'] or l['window'][0] <= l['min'] <= l['window'][1] for l in legs)
res = {'km': round(km, 1), 'km_order_list': round(km_list, 1), 'km_nearest_next': round(km_nearest, 1), 'drive_min': round(drive), 'back': back, 'windows_met': ok, 'stops': legs}
json.dump(res, open(f'{out}/route.json', 'w'), indent=1, ensure_ascii=False)
print(f'best loop: {km:.1f} km · drive {drive:.0f} min · back {back} · windows met: {ok} · in order-list order: {km_list:.1f} km · nearest-next: {km_nearest:.1f} km')

# ---- the map ----
line = []
for a, b in zip(order, order[1:]): line += [coord[v] for v in P[a, b]]
allp = [coord[v] for v in nodes] + line
x0, x1 = min(p[0] for p in allp), max(p[0] for p in allp)
y0, y1 = min(p[1] for p in allp), max(p[1] for p in allp)
W, H = 1200, 900
pad = 300
w, h = x1 - x0 + 2 * pad, y1 - y0 + 2 * pad
if w / h > W / H: h = w * H / W
else: w = h * W / H
mx, my = (x0 + x1) / 2, (y0 + y1) / 2
ext = (mx - w / 2, mx + w / 2, my - h / 2, my + h / 2)
fig = plt.figure(figsize=(W / 100, H / 100), dpi=100)
ax = fig.add_axes([0, 0, 1, 1]); ax.set_xlim(ext[0], ext[1]); ax.set_ylim(ext[2], ext[3]); ax.axis('off')
fig.patch.set_facecolor('#f1efe8'); ax.set_facecolor('#f1efe8')
scale = W / w  # px per metre
for pts in green: ax.add_patch(Polygon(pts, closed=True, fc='#dfe7d3', ec='none', zorder=1))
for pts in water: ax.add_patch(Polygon(pts, closed=True, fc='#bcd0dc', ec='none', zorder=2))
for pts in built: ax.add_patch(Polygon(pts, closed=True, fc='#e3ded3', ec='none', zorder=3))
WID = {'motorway': 7, 'trunk': 6, 'primary': 6, 'secondary': 5, 'tertiary': 4.2, 'unclassified': 3.2, 'residential': 2.8, 'living_street': 2.4, 'service': 1.4}
for hw, pts in sorted(roads, key=lambda r: WID.get(r[0].replace('_link', ''), 0)):
    k = hw.replace('_link', '')
    if k not in WID: continue
    xs, ys = zip(*pts); lw = WID[k] * 0.9
    ax.plot(xs, ys, color='#d6d0c4', lw=lw + 1.2, solid_capstyle='round', zorder=4)
for hw, pts in sorted(roads, key=lambda r: WID.get(r[0].replace('_link', ''), 0)):
    k = hw.replace('_link', '')
    if k not in WID: continue
    xs, ys = zip(*pts)
    ax.plot(xs, ys, color='#fdf6e3' if k in ('motorway', 'trunk', 'primary', 'secondary') else '#ffffff', lw=WID[k] * 0.9, solid_capstyle='round', zorder=5)
ROUTE = '#2f6f5e'
xs, ys = zip(*line)
ax.plot(xs, ys, color='white', lw=11, solid_capstyle='round', solid_joinstyle='round', zorder=6, alpha=.9)
ax.plot(xs, ys, color=ROUTE, lw=6, solid_capstyle='round', solid_joinstyle='round', zorder=7)
r = 21 / scale
for l, k in zip(legs, order[1:-1]):
    x, y = coord[nodes[k]]
    first = l['n'] == 1
    ax.add_patch(Circle((x, y), r, fc='#b45a33' if first else 'white', ec=ROUTE if not first else 'white', lw=2.2, zorder=8))
    ax.text(x, y - r * 0.06, str(l['n']), ha='center', va='center', fontsize=15, fontweight='bold', color='white' if first else '#1f4a3f', zorder=9, family='DejaVu Sans')
x, y = coord[studio]
ax.add_patch(FancyBboxPatch((x - 62 / scale, y - 21 / scale), 124 / scale, 42 / scale, boxstyle=f'round,pad=0,rounding_size={9 / scale}', fc='#23432c', ec='white', lw=2, zorder=10))
ax.text(x, y, 'Studio', ha='center', va='center', fontsize=17, color='white', fontweight='bold', zorder=11, family='DejaVu Sans')
ax.text(ext[1] - 12 / scale, ext[2] + 12 / scale, '© OpenStreetMap contributors', ha='right', va='bottom', fontsize=15, color='#55524a', zorder=12, family='DejaVu Sans',
        bbox=dict(fc='#f1efe8', ec='none', alpha=.85, pad=3))
# scale bar, 1 km
sx, sy = ext[0] + 22 / scale, ext[2] + 24 / scale
ax.plot([sx, sx + 1000], [sy, sy], color='#55524a', lw=4, zorder=12, solid_capstyle='butt')
ax.text(sx + 500, sy + 9 / scale, '1 km', ha='center', va='bottom', fontsize=15, color='#55524a', zorder=12, family='DejaVu Sans')
fig.savefig(f'{out}/route-map.png', dpi=100, facecolor=fig.get_facecolor())
print('route-map.png written')
