# Liitteen tallennus ja merkki – kierros 1

- **Nyt**: tuotannon `AttachmentChips` sellaisenaan: tavallinen edistymisrengas ja prosentti, odottava tiedosto näyttää "0 %".
- **1 Merkki täyttyy**: merkin rengas (24 px) piirtyy ovelta myötäpäivään sitä mukaa kuin tavuja lähtee, haalean koko merkin päälle. Asukasta ei ole, ennen kuin palvelin on tallentanut tiedoston. Tallennuksen aikana asukas astuu ovesta sisään, ja valmis tiedosto sulkee oven (tuotannon `done`). Sen jälkeen siru asettuu tiedoston kuvakkeeksi tai pikkukuvaksi.
- **2 Merkki ja palkki**: tuotannon `HabitatMark` sellaisenaan, lataustilassa (`loading`), ja edistymisen näyttää ohut palkki sirun alareunassa sekä prosentti. Valmis on `done`, katkennut `error`.
- **3 Merkki kehyksenä**: 28 px:n merkki pikkukuvan paikalla. Asukas kävelee ovelta keskelle edistymisen mukaan, ja sirun tausta täyttyy vasemmalta. Valmis kuva asettuu renkaan pyöristettyyn neliöön.

Issue `upload-animation-uses-mark`. Suositus ja päätökset ovat issuen
`result.md`:ssä.

Sivu on viisi tuotannon `Composer`ia, joiden `beforeField` piirtää sirut
ja katkenneen tallennuksen tuotannon `AttachmentRefusal`-palkin. Jos agentin
vuoro on käynnissä, kentän yllä on tuotannon `WorkingProgress`. Nyt-suunnan
sirut ovat tuotannon `AttachmentChips`. Kierroksen oma `UploadChips` on
`AttachmentChips`in merkintä luokkineen ja `attachment-progress`-progressbareineen;
vain sirun kuva ja prosenttiteksti vaihtuvat. Tilanteet ovat samat kaikissa
suunnissa: pieni tiedosto, iso hidas tiedosto, jonka siirto välillä
pysähtyy, viisi tiedostoa agentin työskennellessä, tallennus palvelimella
ja katkennut siirto, jonka jälkeen yksi tiedosto odottaa. Toista soittaa
tilanteen alusta, ja Yritä uudelleen aloittaa katkenneen tiedoston alusta,
kuten tuotanto. `?theme=light|dark|contrast` valitsee alkuteeman.

## How "uploading" stays distinct from "agent working"

The agent's working mark is a full open ring whose door travels round it,
and the resident is always home. The batch scene shows it above the field,
next to the chips, so the comparison is on the page.

- **1** The ring is partial and grows from the door. It stands still where
  the bytes are and never travels. The resident is missing until the host has
  the file, and a mark with nobody home never means an agent. A stalled
  transfer looks stalled instead of busy.
- **2** It uses `loading`, the mark's existing "not home yet" state (a
  growing and shrinking ring, faded resident), never `working`. The bar
  carries the progress. The motion is close to `working` at 20 px, though,
  and the mark itself says nothing about how far the upload has got, which
  is why this is not the recommendation.
- **3** The ring never moves. Progress is the resident's position (from the
  door to the middle) and the chip's fill, and the larger size and its
  place as the file's thumbnail separate it from the 16 px agent marks.

## Accessibility

The chip keeps production's `role="progressbar"` with `aria-valuenow` as the
whole percentage and `aria-valuetext` for Odottaa tallennusta, Tallennetaan
and Tallennus katkesi. The visible text is the real percentage in every
direction, so neither motion nor the mark is the only carrier. With reduced
motion, nothing in the progress animates: the ring, bar and resident jump to
their values, and in 1 the saving resident stands in the door. With forced
colours, the track is GrayText, the drawn ring and bar CanvasText and a
failure Highlight. Direction 3's background fill, which the browser drops,
becomes the bar along the lower edge.

## What production would need

- `HabitatMark` does not export the ring path. Direction 1 would be a
  `progress` prop (0–1) on `HabitatMark` that draws a track plus a partial
  ring and leaves out the resident, together with an `uploading`/`saving`
  pair of states in `HabitatMark.css`. Direction 3 would need the resident
  position as a prop.
- The chip's "just saved" moment (`Tallessa`, 1.2 s) does not exist today:
  a saved upload turns straight into an attachment chip. The composer would
  keep the saved reference's chip in a short `done` phase before showing the
  thumbnail. That stays inside the browser; the host contract does not
  change.
- A waiting file says Odottaa tallennusta (the catalog string exists but is
  unused) instead of 0 %.

## Build and check

```
node design-system/prototypes/rounds/2026-11-14-upload-mark/build.mjs <out>
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright \
  node design-system/prototypes/rounds/2026-11-14-upload-mark/check.mjs <out>/offline.html <out>/shots [--quick]
```

In the offline page, Nyt's saved image shows its thumbnail through a data
URL. A host-served `/thumbnail` does not exist here.
