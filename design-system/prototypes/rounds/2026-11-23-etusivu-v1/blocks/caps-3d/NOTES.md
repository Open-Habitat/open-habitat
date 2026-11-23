# caps-3d

Capabilities: 3D and making. One showpiece, real from the model to the
picture: a spare bracket for a display rail, designed from five dictated
measurements and tried in a slicer before anyone walks to the printer.

## What the reader sees

Bob dictates that the bracket snapped at the bend and gives the five sizes
he measured. The reply is short: here is the bracket, ready for the printer
(time, grams, no supports), and the two things the agent chose because of
where the old one broke. Beside it the view opens on the rendered part with
its measurements drawn over it. “The part” takes the measurements off; “On
the printer” shows the sliced print on the bed, with a slider through nine
layers from the first to the last, the print time, the weight and a colour
key. Under the picture the five sizes stand as the named numbers they are in
`bracket.scad`, which is the “one number away” the reply promises.

## What changed from round 6, and why

- The hand-drawn isometric sketch is gone. Everything in the view is made
  from `bracket.scad` in this directory by the programs the tool rows name.
- The ask now tells the story in the person's words (it snapped at the
  bend, nobody sells it) and carries the measurements; the reply leads with
  the result and then says what was chosen and why. The agent's two choices
  (rounded bend, printed standing on its end so the layers run around the
  bend) are what make it more than a transcription of five numbers.
- The work is worth opening: the model's named numbers, OpenSCAD's own
  output, the slicer's own progress lines and the three lines grepped from
  the G-code. All outputs are copied from the real runs.
- The row's program is now “OpenSCAD, PrusaSlicer, Blender” (CadQuery is not
  used), and its result line mentions the slicer check. The group line
  dropped “a product film without a studio”: that film is Carol's tote, and
  the two other rows of this group only point to Carol's and Erin's days.
- No new list rows: the `n` numbers come from the research list, which this
  block does not own.

## Assets and how they were made

`node blocks/caps-3d/assets.mjs` (stages `model slice render encode`) writes
eleven files, 0.6 MB in all, into `$ETUSIVU_ASSETS/caps-3d/`:

| File | Made by |
|---|---|
| `bracket.webp` (1200 × 900) | Blender 4.5.3 LTS, Cycles on the CPU, `scene.py part`: the STL that OpenSCAD exported, with a printed-PETG material (0.2 mm layer lines as a bump along the rail) |
| `bracket-sizes.svg` | `assets.mjs`: the five sizes read from `bracket.scad`, drawn as dimension lines projected with the camera matrix Blender wrote (`cam.json`), so they sit on the part's real corners |
| `layer-001.webp` … `layer-310.webp` (nine, 1000 × 750) | Blender, `scene.py sliced`: every extrusion move of the G-code PrusaSlicer wrote (87,942 moves) drawn as a bead with its own width and height, in PrusaSlicer's feature colours, up to that layer |

Programs and commands:

- **OpenSCAD 2021.01** (official aarch64 AppImage, extracted; run under
  `xvfb-run -a`): `openscad -o bracket.stl bracket.scad`. 1,142 vertices,
  765 facets, “Simple: yes”.
- **PrusaSlicer 2.7.4** (official Linux arm64 tarball):
  `prusa-slicer --export-gcode --layer-height 0.2 --first-layer-height 0.2 --perimeters 3 --fill-density 20% --fill-pattern gyroid --filament-type PETG --temperature 240 --bed-temperature 85 --nozzle-diameter 0.4 --extrusion-width 0.45 --first-layer-extrusion-width 0.5 --filament-diameter 1.75 --filament-density 1.27 --skirts 1 --center 110,110`.
  It reported 310 layers, 17.69 g, 1 h 17 min 40 s, `support_material = 0`.
  These are the numbers in the reply and the view (`PRINT` in `block.js`);
  after a change to the model, `assets.mjs slice` prints them again.
- **Blender 4.5.3 LTS** (official Linux x64 tarball), 160 and 96 samples
  with denoising. Blender publishes no Linux arm64 build, so `render` ran on
  an x64 machine with `CAPS3D_WORK` copied across; the other stages ran on
  the arm64 build host.
- **ffmpeg** (libwebp, quality 90 to 92) for the WebP files. The installed
  ImageMagick 6.9 ignores `-quality` for WebP and wrote blotchy pictures.

`bracket.scad` and `scene.py` are sources and are committed; the STL, the
G-code and the pictures are not.

## Sources and licenses

No third-party material. The model, the scene and all pictures were made
for this block. The colours of the sliced view are the ones PrusaSlicer
uses for the same features in its own preview (perimeter, external
perimeter, infill, solid infill, skirt); the picture itself is a Blender
render of the G-code, not a capture of PrusaSlicer's window.

## Assumptions about the product

- The agent can run OpenSCAD, PrusaSlicer's command line and Blender in the
  person's account, installed earlier (no installation is shown).
- A view can hold a picture with a toggle and a slider (as in the other
  capability blocks).
- Nothing leaves the host: the agent offers `bracket.stl` for download, and
  taking it to the library's printer is Bob's own step (the row's result
  line).
- “9 min 40 s” is a plausible wall time: the model and the slicing take
  seconds, the pictures a few minutes on a server CPU.

## For Jari

- “A printed part is weakest between its layers” is common FDM knowledge,
  used here as the agent's reasoning, not as a claim about a program.
- The measurement labels are text inside an SVG image, so they use the
  reader's own monospace font, not JetBrains Mono.

## Engine needs

None. (`engine/views.mjs` `toggles()` and the `data-view`/`data-set` switch
did what the view needed; the slider is the block's own `client.js`.)
