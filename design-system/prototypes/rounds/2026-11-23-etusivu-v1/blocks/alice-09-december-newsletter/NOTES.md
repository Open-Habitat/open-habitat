# alice-09-december-newsletter

Alice · 14:30 · December newsletter.

## What the reader sees

The ask, then a second message sent three minutes later while the agent
worked ("Leave out the wholesale shops"). The reply counts the list as a
small table, 512 buyers down to 386, and says in bold that nothing has been
sent. The view is the letter itself as it would arrive: an envelope strip
(subject, sender, "to 386 people", a "Draft · not sent" pill) and Example
Studio's own newsletter with a hero photo of the three winter prints, two
products, the 30-day returns line and the button.

## What changed and why

- **Story (`did`)** rewritten around what she gets: she changes her mind
  without stopping or restarting anything, every excluded name has a reason,
  and the letter waits for her yes.
- **The work is worth opening.** Seven steps in order: the first count (442)
  happens before her message; a thought records the message arriving; the
  second run adds `--without team/wholesale-accounts.csv` and lands on 386;
  then the photos, the HTML, and a check that ends in `sent: nothing`. The
  sums hold: 512 − 61 − 9 − 56 = 386 and 61 + 9 + 56 = 126.
- **The reply** carries the count as a Markdown table (the product renders
  tables), so the reasoning is visible without opening the work.
- **The letter** replaces the round-6 striped placeholder. The envelope strip
  uses the design-system tokens; the letter inside has Example Studio's own
  look (warm paper, a serif headline from the system serif stack, rust and
  fern green accents). No web font is loaded.
- The time, the sidebar line ("Draft for 386 people") and the conversation id
  are unchanged, so `alice-day` needs nothing.

## Assets

All three pictures are my own renders; nothing third-party.

| File | Size | What |
|---|---|---|
| `winter-prints.webp` | 1200 × 540, 39 KB | three linen tea towels on wooden pegs: Flower (indigo), Arch (rust), Fern (forest green) |
| `cushion-fern.webp` | 640 × 640, 13 KB | Fern cushion cover on a green tint |
| `cushion-indigo.webp` | 640 × 640, 18 KB | Flower cushion cover on a blue tint |

How they are made (`assets.mjs`, reproducible):

1. **Blender 4.0.2, Cycles on CPU**, runs `linen.py` once per picture:
   `blender -b --python linen.py -- <towels|cushion-fern|cushion-indigo> <out.png> 320`.
   The linen is a cloth simulation: each towel is a 50 × 70 cm sheet hung on
   two pegs set closer than the cloth is wide and left to settle for 110
   frames against the wall; each cover is two sewn sheets blown up with
   pressure for 45 frames. The three block prints are drawn in the script
   with numpy as tiling ink masks, and the shader eats the stamp's edges and
   thins the ink the way a hand-pressed block does. Output is a 16-bit PNG
   cut-out with its shadow (transparent film, shadow catcher).
2. **ImageMagick 6** (`convert`) puts each cut-out on its panel colour,
   crops it for its slot and writes WebP at quality 84.

`BLENDER` names the binary. `LINEN_SAMPLES` changes the sample count, and
`LINEN_RENDERS=<dir>` reuses PNGs already rendered there. The three renders
take about four minutes on eight cores.

This machine is arm64, where Blender publishes no official Linux build (the
x64 tarball does not run). I used Ubuntu noble's own arm64 package
(`blender 4.0.2+dfsg-1ubuntu8` with its dependencies and `python3-numpy`),
fetched with `apt-get download` and unpacked with `dpkg -x` into scratch,
not installed. That build has no denoiser, so the script falls back to more
samples. An official 4.x build on x64 runs the same script and denoises.

`linen.py` sits beside `assets.mjs` as its input; BLOCKS.md's file table does
not list such a file, and the build does not mind it.

## Sources and licenses

No third-party material. The product names, prints and prices are invented.

## Assumptions about the product

- A message sent while the agent works is delivered at its next step and
  shown as the person's message with a quiet note; the turn is one turn.
- The reply card renders a Markdown table.
- The view can show an HTML file the agent wrote.
- The agent could send the letter after her yes; the scene stops before it.

## Engine needs

- **`--only` and a neighbour's assets.** The sidebar holds every
  conversation's screen as a template, so a page built with
  `--only alice-12-before-i-go` references this block's three pictures
  without copying them, and the check reports three `ERR_FILE_NOT_FOUND`.
  The build should copy the assets of every block whose screen it renders,
  not only the block named.
- **The view sits under the conversation in Alice's sticky screen** (the
  container is narrower than 640 px) and the screen is anchored to its
  bottom, so on arrival at 1440 px the reader sees the whole letter and has
  to scroll up for the reply and its count. I sized the letter to fit the
  visible height. If the conductor wants the reply visible too, the screen
  needs a side-by-side layout at that width or a shorter view.

## For Jari

- The reply says "open in the view", not "beside this", because of the point
  above.
- The letter shows prices (€38). Say if the shop should stay priceless.
