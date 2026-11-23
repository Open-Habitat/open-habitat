# Paved surfaces on an OpenDroneMap orthophoto, in square metres.
#
#   python measure.py <odm_orthophoto.tif> <dsm.tif> <out-dir>
#
# An orthophoto is true to scale: every pixel covers the same piece of ground.
# So an area is a count of pixels times the area of one. Asphalt and concrete
# are the pale, colourless ground; grass, soil, water and roofs have colour.
# Writes ortho.png (the part of the map the page shows), paved.png (the
# surfaces found, as an overlay of the same size) and prints the areas.
import sys
from pathlib import Path

import numpy as np
import rasterio
from PIL import Image
from rasterio.enums import Resampling
from rasterio.windows import from_bounds
from scipy import ndimage as ndi

tif, dsm_tif, out = sys.argv[1], sys.argv[2], Path(sys.argv[3])
out.mkdir(parents=True, exist_ok=True)

STEP = 4            # measure on every 4th pixel: 16 cm on the ground
MIN_M2 = 12         # smaller patches are stones, benches and glare
CAR_M2 = 40         # a hole up to this size in paved ground is a parked car
ROOF_M, ROOF_SPAN_M = 1.5, 16.0  # higher than this above the lowest ground within the span: not ground
WIDE_M = 5.0        # paved ground wider than this is car park or drive, narrower is path
# The park lies east of the road and north of the tree line; both lines were
# read off the orthophoto (metres from its west and north edge).
ROAD_EAST_M, TREE_LINE_M = 27.5, 236.0
# The sky reflected in the pond is as grey as asphalt: the pond is left out.
POND = dict(x0=95.0, x1=182.0, y0=42.0, y1=84.0)
# The part the page shows: metres from the west and north edge, and its size.
VIEW = dict(x=16.0, y=36.0, w=265.0, h=212.0, px=(1000, 800))
CAR, PATH = (255, 176, 32), (64, 214, 255)

with rasterio.open(tif) as r:
    res = r.res[0]
    h, w = r.height // STEP, r.width // STEP
    a = r.read(out_shape=(r.count, h, w), resampling=Resampling.average).astype(np.float32)
    left, top = r.bounds.left, r.bounds.top
    b = (left + VIEW['x'], top - VIEW['y'] - VIEW['h'], left + VIEW['x'] + VIEW['w'], top - VIEW['y'])
    view = r.read(window=from_bounds(*b, r.transform), out_shape=(r.count, VIEW['px'][1], VIEW['px'][0]), resampling=Resampling.lanczos)
m = res * STEP                       # metres per measured pixel
# The surface model from the same run tells ground from roof: a roof is as grey
# as concrete, but it stands above the ground around it.
with rasterio.open(dsm_tif) as r:
    dsm = r.read(1, out_shape=(h, w), resampling=Resampling.average, masked=True).filled(np.nan)
dsm = np.where(np.isfinite(dsm), dsm, np.nanmedian(dsm))
k = int(ROOF_SPAN_M / m)
raised = dsm - ndi.grey_opening(dsm[::4, ::4], size=(k // 4, k // 4)).repeat(4, 0).repeat(4, 1)[:h, :w] > ROOF_M
rgb, seen = a[:3] / 255, a[3] > 200
hi, lo = rgb.max(0), rgb.min(0)
sat = (hi - lo) / np.maximum(hi, 1e-6)
paved = seen & (sat < .13) & (hi > .42) & ~raised
paved = ndi.binary_opening(paved, iterations=2)          # drop specks
paved = ndi.binary_closing(paved, iterations=4)          # close painted lines and seams
# Parked cars stand on the car park: fill the small holes in the paved ground
# (a lawn inside a loop of path is a large hole and stays open).
holes = ndi.binary_fill_holes(paved) & ~paved
lab, n = ndi.label(holes)
size = ndi.sum(holes, lab, range(1, n + 1)) * m * m
paved |= np.isin(lab, 1 + np.flatnonzero(size <= CAR_M2))
lab, n = ndi.label(paved)
size = ndi.sum(paved, lab, range(1, n + 1)) * m * m
paved = np.isin(lab, 1 + np.flatnonzero(size >= MIN_M2))

yy, xx = np.mgrid[0:h, 0:w]
inside = (xx * m > ROAD_EAST_M) & (yy * m < TREE_LINE_M)
paved &= ~((xx * m > POND['x0']) & (xx * m < POND['x1']) & (yy * m > POND['y0']) & (yy * m < POND['y1']))
road = paved & ~inside
park = paved & inside
# Wide ground: what survives an opening with a disc WIDE_M across, grown back.
rad = int(round(WIDE_M / 2 / m))
disc = (np.hypot(*np.mgrid[-rad:rad + 1, -rad:rad + 1]) <= rad)
core = ndi.binary_opening(park, structure=disc)
wide = ndi.binary_dilation(core, structure=disc, iterations=1) & park
lab, n = ndi.label(wide)
if n:  # the car park and its drive are the largest wide surface
    sizes = ndi.sum(wide, lab, range(1, n + 1))
    wide = lab == 1 + int(np.argmax(sizes))
paths = park & ~wide
lab, n = ndi.label(paths)
size = ndi.sum(paths, lab, range(1, n + 1)) * m * m
paths = np.isin(lab, 1 + np.flatnonzero(size >= MIN_M2))

area = lambda mask: float(mask.sum()) * m * m
print(f'{w * STEP} x {h * STEP} px · {res * 100:.1f} cm per pixel · {area(seen) / 10000:.1f} ha')
print(f'car park and drive  {area(wide):7,.0f} m²')
print(f'paths               {area(paths):7,.0f} m²')
print(f'to resurface        {area(wide) + area(paths):7,.0f} m²')
print(f'road, left out       {area(road):7,.0f} m²')
print(f'view {VIEW["w"]:.0f} x {VIEW["h"]:.0f} m at {VIEW["px"][0]} x {VIEW["px"][1]} px')

# The pictures for the page.
img = np.dstack([view[0], view[1], view[2]])
img[view[3] < 128] = (29, 42, 32)
Image.fromarray(img).save(out / 'ortho.png')
x0, y0 = int(VIEW['x'] / m), int(VIEW['y'] / m)
x1, y1 = x0 + int(VIEW['w'] / m), y0 + int(VIEW['h'] / m)
over = np.zeros((y1 - y0, x1 - x0, 4), np.uint8)
for mask, colour in ((wide, CAR), (paths, PATH)):
    part = mask[y0:y1, x0:x1]
    edge = part & ~ndi.binary_erosion(part, iterations=3)
    over[part] = (*colour, 120)
    over[edge] = (*colour, 255)
Image.fromarray(over).resize(VIEW['px'], Image.LANCZOS).save(out / 'paved.png')
