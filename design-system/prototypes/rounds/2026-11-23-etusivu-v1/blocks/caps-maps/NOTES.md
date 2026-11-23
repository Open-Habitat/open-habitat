# caps-maps

Capabilities: Maps and routes. Both showpieces are now made by the programs
the block names; the two round-6 SVG mocks are gone.

## What the reader sees

- **The park from the air (OpenDroneMap).** Mallory asks how much asphalt the
  car park and the paths need. The view opens on the real orthophoto with the
  measured surfaces laid over it and the answer under it: car park 1,283 m²,
  paths 744 m², 2,027 m² to resurface, the public road left out. “Map” shows
  the plain orthophoto, “3D model” a six-second flight around the textured
  model from the same run.
- **The old town poster (OSMnx, Matplotlib).** Alice asks for the old town in
  the shop's two colours with the shop as a dot. The view shows the framed A2
  sheet and the postcard on a wall; “Up close” is a part of the sheet at
  print size.

## What changed and why

- The drone story moved from a housing company's yard to a park association
  (Mallory, Birchwood Park Association), because the real photos are of a
  park. The ask is now a job with a number at the end: quotes for new
  asphalt. Every figure in the block is what the scripts printed for these
  photos; nothing is rounded to look better.
- The work inside is what was actually run: the ODM log lines, the real
  output of `measure.py`, and a `read` step that says what the check of the
  overlay found (the first pass did mark sky reflected in the pond as paving;
  the script now leaves the pond out). The reply says what the figure does
  not cover: tree crowns hide some path.
- The poster row's program is “OSMnx, Matplotlib” instead of “prettymaps,
  OSMnx”: that is what drew it. The `pdfinfo` row is the real output for the
  A2 file. The reply says where the data comes from, that the credit line is
  on both sheets, and that nothing has gone to a printer.
- The group line names the three things a reader can want here: measured
  from the air, drawn for the wall, driven in the best order.
- `client.js` only plays the flight in a loop while “3D model” is chosen
  (not with reduced motion; the video keeps its own controls).

## Assets and how they were made

`node blocks/caps-maps/assets.mjs` (set `TMPDIR`; work directory
`$CAPS_MAPS_WORK`, default `$TMPDIR/caps-maps-work`). The whole block is
1.8 MB.

| File | Size | Made by |
|---|---|---|
| `park-ortho.webp` | 137 KB | OpenDroneMap 3.6.2: `podman run --rm -v <datasets>:/datasets docker.io/opendronemap/odm:3.6.2 --project-path /datasets yard --orthophoto-resolution 4 --dsm --max-concurrency 8`. 77 of 77 photos placed, 16.1 million points, orthophoto 9,274 × 7,383 px at 4 cm, 15 min 26 s on 8 arm64 cores. The page shows a 265 × 212 m part at 1000 × 800 px, cut by `src/measure.py`. |
| `park-paved.webp` | 22 KB | `src/measure.py` (rasterio, SciPy): pale colourless pixels of the orthophoto that do not stand above the ground in ODM's surface model, grouped into surfaces; car-sized holes filled; wider than 5 m is car park, narrower is path; west of the road line and south of the tree line is “outside the park”. The two boundary lines and the pond's box were read off the orthophoto and are constants in the script. |
| `park-model.mp4`, `park-model.webp` | 1.4 MB, 76 KB | `src/flight.py`: PyVista 0.49.2 (VTK, off screen under `xvfb-run`) draws 144 frames of ODM's `odm_textured_model_geo.obj` with its photo textures, unlit; ffmpeg: `-framerate 24 -vf eq=gamma=1.15 -c:v libx264 -preset veryslow -crf 23 -pix_fmt yuv420p -movflags +faststart -an`. 960 × 600, 6 s, no audio. |
| `old-town-a2.webp`, `old-town-postcard.webp`, `old-town-detail.webp` | 98, 39, 58 KB | `src/poster.py`: OSMnx 2.2.0 fetches streets, water, buildings and green areas 1.7 km around the centre from the Overpass API, GeoPandas 1.2.0 projects them to UTM, Matplotlib 3.11.2 draws the A2 sheet (420 × 594 mm, 1,280 m across) and the postcard (148 × 105 mm, 940 m across) as vector PDF and as 2,400 px PNG. The detail is an unscaled 840 × 1050 px cut of the A2 PNG. ImageMagick `convert` writes the WebP files. |

The PDFs (A2 543 KB, postcard 195 KB) stay in the work directory; the A2 one
is over the 500 KB limit for other files, so the offer card names it without
shipping it.

## Sources and licenses

- **Drone photos:** OpenDroneMap sample dataset “aukerman”, 77 photos,
  <https://github.com/OpenDroneMap/odm_data_aukerman> (commit `4e80316`).
  Licence: CC0 1.0 Universal (`license.txt` in that repository). No
  attribution required. The orthophoto, the surface model and the 3D model
  are our own results from those photos. The photos show a public park with
  a few parked cars; at the shipped size (26 cm per pixel) no plate or person
  is readable.
- **Map data:** © OpenStreetMap contributors, Open Database License 1.0,
  <https://www.openstreetmap.org/copyright>. The poster and postcard are
  produced works; the credit line is printed on both and repeated under the
  view. Fetched through the public Overpass API on 23.11.2026.
- **Typeface on the poster:** Instrument Sans from `design-system/fonts`
  (SIL Open Font License 1.1).
- **Programs** (not shipped): OpenDroneMap (AGPL-3.0), OSMnx (MIT),
  GeoPandas (BSD-3), Matplotlib (PSF-style), PyVista (MIT), VTK (BSD-3),
  rasterio (BSD-3), SciPy (BSD-3), ffmpeg, ImageMagick.

No claim that a program leads its field is made in this block.

## Assumptions about the product

- OpenDroneMap is available as an `odm` command in Mallory's environment
  (in the scene: installed beforehand; here it ran from the project's
  container image with podman). The scene shows no installation.
- A photogrammetry run of a quarter of an hour inside one turn, and a view
  that shows an image with a toggle and a video, as other blocks assume.

## For Jari

- **The poster is a real place.** The street plan is the historic centre of
  Český Krumlov, chosen because a river in two tight bends reads well in two
  colours. The page and the poster never name it (“The Old Town”), and the
  shop's dot is an invented point on a lane. If a recognisable real town
  under a fictional shop is not wanted, change `CENTRE` and `SHOP` in
  `src/poster.py` and rerun; everything else follows.
- The park is a real park in the sample data's home region; the page calls
  it only “the park” of an invented association.
- The paved figures are an honest image measurement, not a survey: the
  reply says so for the paths. The car park figure includes its drive up to
  the road line.

## Engine needs

- The checker screenshots a state right after clicking its toggle; an image
  that was `display: none` until then (`loading="lazy"`) can still be blank
  in that screenshot (“Up close” in `…-1-open.png`). It loads normally in a
  browser. A short wait after a toggle click in `check.mjs` would show it.
- A view with more than one state has no way to say which state a
  screenshot or the no-JavaScript page should show other than the default;
  fine here (the default is the answer), noted in case others need it.
