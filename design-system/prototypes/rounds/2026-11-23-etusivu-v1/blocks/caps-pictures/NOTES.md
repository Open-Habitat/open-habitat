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
  it: sure, and unsure but blurred anyway (one of those is a fold in a white
  shirt, which is the point of the rule).

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

## The market photo was replaced (24.11.)

Jari decided to swap the first market photo (rawpixel's “Flea market,
Utrecht”): its CC0 status was only Openverse's record, because the source
page could not be read, and it showed real shop names out of focus. The new
one is a photograph of a street market in Normandy from Wikimedia Commons,
whose licence was read on the file page itself (below). The view shows the
lower middle of it: stalls, awnings, shoppers; no shop sign, street sign or
place name is in the crop.

- The detector now works on real pixels (the crop at 1280 × 960, from the
  3840 px rendering) and the shipped picture is 960 × 720 instead of
  640 × 480, so it is sharp on a dense screen.
- The numbers follow the program: 30 detections, 11 sure, 19 unsure and
  blurred anyway, none skipped. The key under the picture lost its “1 left
  alone” item and says so; the conversation's totals for all 64 photos (412
  blurred, 131 on a low score, 3 skipped) are the story's and were not
  changed, and they do not contradict this photo.
- **Two T-shirt prints are softened by hand-set boxes** (`PRINTS` in
  `assets.mjs`): a clothing brand's lettering on one shirt and a brand's
  chest emblem on another. Both were already unreadable at the shipped size;
  softening them keeps a real brand off the page for certain. They are not
  detections, are not counted and are not drawn in “What it found”.
- Considered and dropped: a prettier CC0 photo of a Saturday market in an
  Italian town. Its Commons page carries the Italian cultural-heritage
  notice, which asks for a ministry authorisation before use “in any form of
  advertising”. A landing page is advertising.

## Assets

`node blocks/caps-pictures/assets.mjs` writes five files, 140 KB together, to
`$ETUSIVU_ASSETS/caps-pictures/`:

| File | Size | Made by |
|---|---|---|
| `regatta-scan.webp` | 720 × 540, 10 KB | ImageMagick: the scan, `-filter Catrom -resize 400%`, cropped |
| `regatta-x4.webp` | 720 × 540, 17 KB | Real-ESRGAN ×4 of the same scan, same crop |
| `regatta-whole.webp` | 480 × 372, 9 KB | Real-ESRGAN's whole picture, reduced |
| `market-ready.webp` | 960 × 720, 95 KB | OpenCV: faces found by YuNet, blurred with `GaussianBlur` |
| `market-found.svg` | 7 KB | the same detections as boxes (written by `assets.mjs`) |

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
  opencv_zoo (sha256 `8f2383e4…552fa4`), run on the 1280 × 960 crop
  enlarged twice, score floor 0.30, “sure” from 0.80; blur is
  `cv2.GaussianBlur` under a feathered ellipse. A low-score box wider than a
  fifth of the picture is not blurred but listed. On this photo: 30
  detections, 11 sure, 19 unsure and blurred anyway, 0 skipped. Looked at
  enlarged three times: every face turned to the camera is blurred; the
  people left sharp are seen from behind. `block.js` quotes those three numbers; `assets.mjs` prints
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
| Street-market photograph, 1 August 2024 (“Market on Avenue de la Gare, Houlgate, 2024”), 5,662 × 3,765 px, sha1 `c62dade9…6d20f044` | Wikimedia Commons, own work of user DimiTalen: `https://commons.wikimedia.org/wiki/File:Market_on_Avenue_de_la_Gare,_Houlgate,_2024.jpg` | CC0 1.0, read on the file page on 24.11.2026 (text below). No attribution required; credit: DimiTalen / Wikimedia Commons |
| `RealESRGAN_x4plus.pth`, Real-ESRGAN code | `github.com/xinntao/Real-ESRGAN` | BSD-3-Clause (used to make the picture, not shipped) |
| `face_detection_yunet_2023mar.onnx` | `github.com/opencv/opencv_zoo` | MIT (not shipped) |

The market photo's licence as its Commons file page states it, under
“Licensing” (wikitext `{{self|cc-zero}}`):

> I, the copyright holder of this work, hereby publish it under the following
> license: This file is made available under the Creative Commons CC0 1.0
> Universal Public Domain Dedication. The person who associated a work with
> this deed has dedicated the work to the public domain by waiving all of
> their rights to the work worldwide under copyright law, including all
> related and neighboring rights, to the extent allowed by law. You can copy,
> modify, distribute and perform the work, even for commercial purposes, all
> without asking permission.

The page carries no other restriction template (no personality-rights or
heritage notice).

Both photographs are modified (cropped, reduced, enlarged, blurred). Neither
is hotlinked; the page loads only the files above.

## For Jari

- The market photo shows real passers-by at a public market, every face
  blurred, and the 1964 photo shows spectators from behind and distant
  crews: no recognisable person in either. CC0 settles the photographer's
  rights, not the rights of the people in the picture; the blur is what
  answers that, and it is also the block's story.
- The market is a real one in France standing in for the invented Maple
  Lane Market. Nothing in the crop names it; the file name and place appear
  only in this file and in `assets.mjs`'s download address.
- The two softened T-shirt prints (above) are the one place where the
  picture is not purely “what the detector found”. Say if you would rather
  have them untouched.
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
