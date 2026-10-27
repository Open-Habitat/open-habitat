# Result: prototype round 3, many files

Prototype: `prototypes/file-offer-many/index.html` is one offline file
with three directions behind the picker.
[NOTES.md](prototypes/file-offer-many/NOTES.md) is Jari's guide in Finnish,
and `prototypes/file-offer-many/evidence/` holds the screenshots at device
scale factor 2. The round's source is
`design-system/prototypes/rounds/2026-10-27-monta-tiedostoa/`. Its
`verify.mjs` rebuilds the page into this issue and checks 12
direction × width × theme cases:

- four offer cards and the version notes;
- the gallery stepping and returning focus;
- Ryhmät's groups and its conversation file filter;
- Kansio's folder navigation, folder zip, package search and the
  unfolding of the old version;
- Hylly's panel from the top bar and from a card, its search, its
  preview and Escape;
- download toasts;
- no horizontal overflow, console errors or network requests.

## Starting point

- Round 1 chose Kortti. Round 2 recommends Kurkistus, which awaits Jari.
  It is the single-file card here, and the juliste is identical in all
  directions.
- `agent view offer` already freezes a directory (at most 500 files and
  50 MiB) into `~/.local/state/open-habitat/views/<id>/` with a manifest.
  So a file offer of a directory is a second export kind of the same
  mechanism. The 50 MiB cap is too small for a photo package: this one is
  97 MB.

## Axis and directions

The axis is **what organises a large set of files**. The content is the
same in every direction:

- one poster;
- a 32-file partner package in five folders: four stage folders with 5–6
  photos and a GPX each, `logot/`, and root documents;
- 12 flat social images;
- a re-offer of the same folder, with 2 changed photos and 1 new logo.

Shared by all directions:

- The newer offer of the same source says *Korvaa klo 13.19 tarjotun
  version: 2 muuttunutta, 1 uusi* and marks the files *muuttunut* or
  *uusi*.
- The older offer points to the newer one.
- The preview dialog steps through one offer's images (‹ ›, arrow keys,
  "3 / 24") and shows the folder.

1. **Ryhmät**: the card shows a mosaic of five photos and *+N*. Below it,
   type groups (Valokuvat, Logot, Reitit, Asiakirjat) expand in place,
   and each row shows its folder as muted text. Actions are *Lataa kaikki
   (.zip)* and *Selaa kuvia (N)*. To find a file later, the top-bar
   *Tiedostot* toggle filters the conversation to its offer cards and
   adds a name search across them, keeping the conversation order.
2. **Kansio**: the card is the folder. The root lists sub-folders with
   count, size and three thumbnails. A folder opens as a thumbnail grid
   with a breadcrumb back and its own *Lataa kansio* zip. Packages over
   12 files get a search field inside the card. The superseded version
   folds to one line (*korvattu klo 13.47 uudemmalla versiolla*) that can
   be unfolded. Finding is per offer.
3. **Hylly**: the card is a compact summary: a thumbnail strip, folder
   names with counts, *Lataa kaikki (.zip)* and *Näytä tiedostot*. A
   top-bar files button (46) opens a side panel, which is full screen on a
   phone. The panel lists every offer in the conversation, newest first
   and by folder, with search across all offers and a preview of the
   selection. Superseded offers sit under *Aiemmat versiot*.

## Host facts each direction needs

| Fact | Exists? | Needed by |
| --- | --- | --- |
| `agent file offer --current --source <dir> [--title]` freezing a directory into an offer | No; `agent view offer` freezes directories with the same rules (no symlinks or special files, hidden entries skipped) | all |
| Manifest per file: relative path, bytes, kind, image dimensions, content hash | Views record files and bytes; per-file kind and dimensions are round 2's facts; the hash is new | all; the hash only for the version diff |
| Limits that fit a photo package | Views: 500 files / 50 MiB. This package is 97 MB, so file offers need their own cap (proposal: 500 files, 1 GiB counted against the person's quota) | all |
| Thumbnails | No store. The browser can downscale from the owner-only inline route (round 2), but 20+ full-size JPEGs per card means about 80 MB of reads. A server thumbnail (Go `image` + `x/image/draw`, cached beside the frozen copy) or lazy loading of only the visible tiles is needed | 1 (mosaic, 6 tiles), 2 (folder grid, up to ~25 tiles), 3 (strip, 8 tiles, and panel minis) |
| Server-built zip of a whole offer, streamed (`archive/zip` with Store, no temp file) | No | all |
| Zip of one folder inside an offer | No; the same streamer with a prefix filter | 2 |
| "Same source in the same conversation" link between offers, and per-file changed/new against the previous one | No. Either the daemon matches the source path at offer time, or the agent passes `--replaces <offer_id>`; the diff compares manifest hashes | all (version notes); 2 folds the old card, 3 groups it under Aiemmat |
| List of offers per conversation with their manifests | Views have `agent view list` account-wide; the conversation's offers are also in its notices, so the browser can collect them from the transcript it already has | 1 (filter), 3 (panel and count); not needed for 2 |
| Name search | Browser-only over manifests already loaded; no server search | 1, 2 (one offer), 3 (all offers) |

The daemon running as the person serves the files, thumbnails and zips
from the frozen copy in the person's own home, and the gateway authorises
only the owner session, as for view exports. No direction needs a new
authority. The only new stored thing is the thumbnail cache, and it is a
derived file next to the frozen copy that is removed with it.

## Recommendation

**Kansio**, with the version note and the folded old version.

- The person and the agent already think of the package as a folder: the
  person asked for the structure, and the agent made it. Kansio is the
  only direction that shows the package that way. Ryhmät flattens a
  stage's photos into one long list sorted by type. Hylly moves the
  content out of the conversation entirely.
- Folding the superseded version keeps the conversation honest about
  what changed without doubling its length.
- It is also the cheapest on the host. It needs no conversation-wide
  offer list, and finding inside one offer is a browser filter over the
  manifest it already has.

The cost is that finding a file across many offers needs the person to
remember which offer it was in. Hylly's panel solves that. It can be added
later on top of Kansio cards without changing them, once conversations
routinely carry many offers. That was round 1's conclusion too, so it is
not built now.

Thumbnails are the one real host decision. I recommend lazy-loaded tiles
from a small server-side thumbnail (longest side 320 px) generated when
the offer is frozen. Downscaling 25 full-size photos in the browser per
open folder is too slow on a phone.

Questions for Jari (in NOTES.md):
- Is the structure in the conversation or one place for everything more
  important?
- May the superseded version fold to one line?
- Is a per-folder zip wanted, or only *Lataa kaikki*?

## Library suggestion

None needed. The round overrides `markerR` and `APP.actions` locally, adds
its panel to `.frame .body` and its dialog to `.frame`, and stops arrow
keys inside its dialog from reaching the picker's global ←/→ handler.
That handler is worth knowing for any round with in-dialog keyboard
navigation.
