# caps-pictures

Capabilities: Pictures. Two screens drawn in full, both with a real result
from the program the block names, and the list rows.

## What the reader sees

- **Old photos, larger (Real-ESRGAN).** Peggy's 1960s photos exist only as
  small scans. The view is a before/after of one detail: the 400 px scan
  stretched four times on the left of the line, Real-ESRGAN's ×4 picture on
  the right. The reader drags the line (or uses the arrow keys); a small
  locator shows the whole photograph and which part is compared.
- **Market photos (OpenCV).** Judy wants Saturday's market photos online
  without anyone's face. The view shows a real street-market photo with every
  face OpenCV found blurred; “What it found” lays the detector's boxes over
  it: sure, unsure but blurred anyway, and one box left alone.

## What changed from round 6 and why

- The two drawn mocks (a boat made of SVG shapes, six grey tiles with dots)
  are replaced by pictures the programs made. `sw`, `crest` and the legacy
  `.up`/`.blur` styles in `engine/views.css` are no longer used by this block.
- **The blur story moved from a school sports day to a street market**
  (“Judy, Maple Lane School” became “Judy, Maple Lane Market”). Two reasons.
  The old reply said faces stayed sharp when the agent “was sure it was a
  pupil with permission”: that is recognising individual children, which
  OpenCV's detector does not do and the page should not promise. And a real
  showpiece would have needed photographs of real children. The new rule is
  the one a careful person would choose: every face is blurred.
- **The original of the market photo is not shipped**, so there is no
  before/after there. A page about not publishing faces should not publish
  them. The toggle shows what was found instead.
- The work inside “Show work” is now what actually happens: clone and install
  into the person's own folder, the project's own inference command with the
  tiling option, the agent looking at every result beside its scan, a list
  of what to check. The durations are honest: the enlargement took 97 s for
  one 400 px photo on eight CPU cores here, so forty take about an hour.
- Row 29's title lost “and number plates”: the showpiece has none, and
  OpenCV's bundled plate cascade was not tried. The other rows are unchanged.
- The “6 marked” claim is kept and made specific (close-up faces, lettering).
  It is true of the program: on a test with a close-up of a crew, the faces
  came out with invented eyes. That picture is not shipped (real faces).

## Assets

`node blocks/caps-pictures/assets.mjs` writes five files, 80 KB together, to
`$ETUSIVU_ASSETS/caps-pictures/`:

| File | Size | Made by |
|---|---|---|
| `regatta-scan.webp` | 720 × 540, 10 KB | ImageMagick: the scan, `-filter Catrom -resize 400%`, cropped |
| `regatta-x4.webp` | 720 × 540, 17 KB | Real-ESRGAN ×4 of the same scan, same crop |
| `regatta-whole.webp` | 480 × 372, 9 KB | Real-ESRGAN's whole picture, reduced |
| `market-ready.webp` | 640 × 480, 38 KB | OpenCV: faces found by YuNet, blurred with `GaussianBlur` |
| `market-found.svg` | 5 KB | the same detections as boxes (written by `assets.mjs`) |

Programs and versions:

- **Real-ESRGAN 0.3.0** (`pip install realesrgan`, with basicsr 1.4.2,
  torch 2.1.2 and torchvision 0.16.2 CPU wheels, Python 3.11), weights
  `RealESRGAN_x4plus.pth` from the project's v0.1.0 release (sha256
  `4fa0d389…d682f1`). Run through the project's `RealESRGANer` class, as its
  `inference_realesrgan.py` does: scale 4, `tile=200`, `tile_pad=16`, CPU.
  The release's `realesrgan-ncnn-vulkan` binary is x86-64 and needs Vulkan;
  the build machine is arm64 without a GPU, hence the Python package.
  Untiled, this torch build returned a picture with a dark band at the top
  and bottom; with the tool's own tiling the result is clean.
- **OpenCV 5.1.0** (`opencv-python-headless` 5.1.0.95, Python 3.12):
  `cv2.FaceDetectorYN` with `face_detection_yunet_2023mar.onnx` from
  opencv_zoo (sha256 `8f2383e4…552fa4`), run on the photo enlarged twice,
  score floor 0.30, “sure” from 0.80; blur is `cv2.GaussianBlur` under a
  feathered ellipse. A low-score box wider than a fifth of the picture is
  not blurred but listed. On this photo: 28 detections, 9 sure, 18 unsure
  and blurred anyway, 1 skipped (the out-of-focus back of a head in the
  foreground). `block.js` quotes those three numbers; `assets.mjs` prints
  them, so change them there if a different photo or version changes them.
- **ImageMagick 6.9.12** for cropping, the bicubic stretch and WebP.

The first run needs `uv`, network and about 2 GB of scratch in
`$CAPS_PICTURES_WORK` (default `$TMPDIR/caps-pictures-work`); downloads and
the ×4 picture are kept there, so later runs take seconds
(`CAPS_PICTURES_FORCE=1` enlarges again).

## Sources and licenses

| What | Source | Licence |
|---|---|---|
| Regatta photograph, 20 June 1964 (“Roeien in Duisburg op de Wedaubaan, overzicht”, Bestanddeelnr 916-5600) | Nationaal Archief, Fotocollectie Anefo, via Wikimedia Commons: `File:Roeien in Duisburg op de Wedaubaan, overzicht, Bestanddeelnr 916-5600.jpg` | CC0 1.0. No attribution required; credit: Nationaal Archief / Anefo |
| Street-market photograph (“Flea market, Utrecht, Netherlands, 04/13/2021”) | rawpixel, `https://www.rawpixel.com/image/6113547/flea-market-utrecht-netherlands-04132021`, found through Openverse (id `87c83ac8-7d71-4b25-bfd1-68f053eaa760`) | CC0 1.0 according to Openverse's record |
| `RealESRGAN_x4plus.pth`, Real-ESRGAN code | `github.com/xinntao/Real-ESRGAN` | BSD-3-Clause (used to make the picture, not shipped) |
| `face_detection_yunet_2023mar.onnx` | `github.com/opencv/opencv_zoo` | MIT (not shipped) |

Both photographs are modified (cropped, reduced, enlarged, blurred). Neither
is hotlinked; the page loads only the files above.

## For Jari

- **Check the market photo's licence by eye.** Openverse lists it as CC0 1.0,
  but rawpixel's own page sits behind a bot check that a script cannot read,
  so the licence was not confirmed at the source.
- The market photo shows real passers-by, all blurred, and the 1964 photo
  shows spectators from behind and distant crews: no recognisable person in
  either. The market photo also shows a shop's carrier bag and café awnings
  with real names, out of focus. If that is too much for the fictional
  frame, another CC0 photo goes through the same script unchanged.
- The regatta is a Dutch press photo standing in for the fictional Riverside
  Rowing Club's album; the “scan” is that photo reduced to 400 px.
- “Maple Lane Market” is an invented organisation; `caps-web`,
  `caps-print`, `caps-data` or `caps-video-sound` may still say “Maple Lane
  School” for Judy in their own rows, which is a different invented place
  and does not conflict.

## Engine needs

- **A before/after comparison is a natural shared view** (`caps-video-sound`
  and Carol's cut-outs have the same shape). This block carries its own in
  `block.css` and `client.js` (a range input over two stacked pictures that
  sets `--p`); it could move to the kit as `compare(before, after, labels)`.
- `build.mjs`'s selector check splits on every comma, so `:is(.a, .b)` after
  the block prefix is refused. Worked around by writing the selectors out.
