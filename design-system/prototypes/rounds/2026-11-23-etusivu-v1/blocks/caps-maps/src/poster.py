# The neighbourhood poster of caps-maps: an old town from OpenStreetMap in two
# colours, with the shop as a rust dot. OSMnx fetches the area (Overpass API),
# GeoPandas projects it and Matplotlib draws it as vector PDF and as PNG.
#
#   python poster.py <work-dir> <font.ttf>
#
# writes old-town-A2.pdf, old-town-A2.png, old-town-postcard.pdf and
# old-town-postcard.png into <work-dir>. The OSM answer is cached in
# <work-dir>/osm-cache, so a second run needs no network.
# Map data © OpenStreetMap contributors, ODbL 1.0.
import sys
from pathlib import Path

import geopandas as gpd
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import osmnx as ox
from matplotlib import font_manager
import numpy as np
from matplotlib.colors import to_rgb
from matplotlib.patches import Circle, Rectangle
from shapely.geometry import Point, box

work = Path(sys.argv[1])
font = font_manager.FontProperties(fname=sys.argv[2])
ox.settings.use_cache = True
ox.settings.cache_folder = str(work / 'osm-cache')
ox.settings.log_console = False

# The two colours of the ask, and the tints of the dark one that carry water
# and houses. The dot is the shop's rust.
NAVY, CREAM, RUST = '#2f4f73', '#e9e1d2', '#b45a33'
WATER, HOUSE, GREEN = '#213a57', '#47698f', '#335679'
PATH = '#a2aaae'  # cream at 62 % over the navy, for paths and steps

# A river town with a medieval street plan: the historic centre of Český
# Krumlov. The poster does not name it; on the page it is "the old town".
CENTRE = (48.8108, 14.3152)  # lat, lon
SHOP = (48.81065, 14.31545)   # an invented shop: a point on a lane in the centre
FETCH_M = 1700                # half-side of the fetched square, metres

tags = {
    'highway': True,
    'building': True,
    'natural': ['water', 'wood'],
    'waterway': ['river', 'riverbank', 'stream', 'canal', 'weir'],
    'landuse': ['forest', 'grass', 'meadow', 'recreation_ground'],
    'leisure': ['park', 'garden'],
    'railway': ['rail'],
}
feats = ox.features_from_point(CENTRE, tags=tags, dist=FETCH_M)
crs = feats.estimate_utm_crs()
feats = feats.to_crs(crs)
pt = lambda latlon: gpd.GeoSeries([Point(latlon[1], latlon[0])], crs=4326).to_crs(crs).iloc[0]
c, shop = pt(CENTRE), pt(SHOP)

col = lambda name: feats[name] if name in feats.columns else gpd.pd.Series([None] * len(feats), index=feats.index)
is_poly = feats.geom_type.isin(['Polygon', 'MultiPolygon'])
is_line = feats.geom_type.isin(['LineString', 'MultiLineString'])
water = feats[is_poly & ((col('natural') == 'water') | (col('waterway') == 'riverbank'))]
streams = feats[is_line & col('waterway').isin(['stream', 'canal'])]
green = feats[is_poly & (col('natural').isin(['wood']) | col('landuse').notna() | col('leisure').notna())]
houses = feats[is_poly & col('building').notna()]
rail = feats[is_line & (col('railway') == 'rail')]
roads = feats[is_line & col('highway').notna()]

# Street widths in metres on the ground times an exaggeration, so the plan
# reads from across a room. Unlisted classes are not drawn.
WIDTH = {
    'motorway': 16, 'trunk': 16, 'primary': 15, 'secondary': 13, 'tertiary': 11,
    'motorway_link': 9, 'trunk_link': 9, 'primary_link': 9, 'secondary_link': 9, 'tertiary_link': 8,
    'residential': 8, 'unclassified': 8, 'living_street': 7.5, 'pedestrian': 7.5,
    'service': 4, 'track': 3, 'footway': 2.4, 'path': 2.2, 'steps': 2.4, 'cycleway': 2.4,
}


def draw(name, paper_mm, half_w_m, centre, band=0.15, title=True, fat=1.0, edge_mm=9):
    """One sheet: the map bleeds to the edges, the title sits in a band at the foot."""
    pw, ph = paper_mm
    fig = plt.figure(figsize=(pw / 25.4, ph / 25.4), facecolor=NAVY)
    ax = fig.add_axes([0, 0, 1, 1])
    ax.set_facecolor(NAVY)
    half_h = half_w_m * ph / pw
    # The map's centre sits above the middle of the sheet, clear of the title.
    cy = centre.y - half_h * band
    x0, x1, y0, y1 = centre.x - half_w_m, centre.x + half_w_m, cy - half_h, cy + half_h
    ax.set_xlim(x0, x1); ax.set_ylim(y0, y1); ax.set_aspect('equal'); ax.axis('off')
    frame = box(x0 - 50, y0 - 50, x1 + 50, y1 + 50)
    clip = lambda g: g[g.intersects(frame)]
    pt_per_m = (pw / 25.4 * 72) / (2 * half_w_m)

    if len(clip(green)): clip(green).plot(ax=ax, color=GREEN, linewidth=0, zorder=1)
    if len(clip(water)): clip(water).plot(ax=ax, color=WATER, linewidth=0, zorder=2)
    if len(clip(streams)): clip(streams).plot(ax=ax, color=WATER, linewidth=3 * pt_per_m, zorder=2)
    if len(clip(houses)): clip(houses).plot(ax=ax, color=HOUSE, linewidth=0, zorder=3)
    if len(clip(rail)): clip(rail).plot(ax=ax, color=CREAM, linewidth=1.6 * pt_per_m, alpha=.45, linestyle=(0, (6, 4)), zorder=4)
    r = clip(roads)
    for kind, metres in sorted(WIDTH.items(), key=lambda kv: kv[1]):
        sel = r[r['highway'] == kind]
        if len(sel):
            sel.plot(ax=ax, color=PATH if metres < 4.5 else CREAM, linewidth=max(metres * fat * pt_per_m, .25), alpha=1,
                     capstyle='round', joinstyle='round', zorder=5 if metres < 4.5 else 6)

    # The shop: a rust dot with a cream ring.
    rad = half_w_m * .017
    ax.add_patch(Circle((shop.x, shop.y), rad * 1.55, color=CREAM, zorder=8))
    ax.add_patch(Circle((shop.x, shop.y), rad, color=RUST, zorder=9))

    # The foot: the map fades into the paper colour, then the title.
    if title:
        ramp = np.zeros((256, 1, 4)); ramp[..., :3] = to_rgb(NAVY)
        ramp[:, 0, 3] = np.linspace(0, 1, 256) ** 1.5  # row 0 is the top of the fade
        ax.imshow(ramp, extent=(x0, x1, y0 + band * (y1 - y0), y0 + (band + .11) * (y1 - y0)), aspect='auto', interpolation='bilinear', zorder=10)
        ax.add_patch(Rectangle((x0, y0), x1 - x0, band * (y1 - y0) * 1.002, color=NAVY, linewidth=0, zorder=10))
        ax.set_xlim(x0, x1); ax.set_ylim(y0, y1)
    u = ph / 594  # type scale relative to A2
    if title:
        fig.text(.5, band * .60, 'T H E   O L D   T O W N', ha='center', va='center', color=CREAM, fontproperties=font, fontsize=64 * u * (pw / 420) / (ph / 594))
        fig.add_artist(plt.Line2D([.36, .64], [band * .40, band * .40], color=CREAM, linewidth=1.1 * u, alpha=.8))
        fig.text(.5, band * .285, 'E X A M P L E   S T U D I O   ·   A T   T H E   D O T', ha='center', va='center', color=CREAM, alpha=.9, fontproperties=font, fontsize=17 * u * (pw / 420) / (ph / 594))
    if title:
        fig.text(.5, band * .09, '© OpenStreetMap contributors', ha='center', va='center', color=CREAM, alpha=.6, fontproperties=font, fontsize=8.5 * u)
    else:
        fig.text(1 - (edge_mm + 2.5) / pw, (edge_mm + 2.5) / ph, '© OpenStreetMap contributors', ha='right', va='bottom', color=CREAM, fontproperties=font, fontsize=5,
                 bbox=dict(boxstyle='round,pad=.45', facecolor=NAVY, edgecolor='none'), zorder=21)
    # A thin cream keyline inside the edge, as on a printed poster.
    fig.add_artist(Rectangle((edge_mm / pw, edge_mm / ph), 1 - 2 * edge_mm / pw, 1 - 2 * edge_mm / ph, fill=False, edgecolor=CREAM, linewidth=1.2 * max(u, .45), alpha=.85, transform=fig.transFigure, zorder=20))
    fig.savefig(work / f'{name}.pdf', facecolor=NAVY)
    fig.savefig(work / f'{name}.png', facecolor=NAVY, dpi=2400 / (pw / 25.4))
    plt.close(fig)
    print(f'{name} · {pw} x {ph} mm · {2 * half_w_m:.0f} m across\n  {len(clip(r))} street segments · {len(clip(houses))} buildings')


draw('old-town-A2', (420, 594), 640, c, band=0.15, fat=.82)
draw('old-town-postcard', (148, 105), 470, c, band=0.0, title=False, fat=1.15, edge_mm=4)
