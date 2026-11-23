# alice-03-october-receipts

Alice · 08:41 · October receipts. The morning half of the receipts
conversation; the lunch half is `alice-07-lunch-phone`.

## What the reader sees, and why

- **Ask and story.** The quote is unchanged. The story under it now leads with
  what Alice gets: twenty-six charges, a month of mail, a short program, and 23
  receipts in Kirsi's folder named by date, vendor and amount, with the last
  three coming back as questions.
- **The reply sells the result.** A file list of `bookkeeping/2026-10` sits in
  the reply card. Each row has a thumbnail of the receipt's first page (the
  vendor's header), the new file name with the vendor emphasised, the
  attachment it came from, and the amount. Six rows show; "Show all 23" opens
  the rest (`client.js`). Under the list are three concrete questions, each
  with the evidence from the mail ("only next year's price list", "nothing from
  the parking company", "only their newsletter"). They set up Alice's answers
  in `alice-07`.
- **The work is real.** Show work holds one thought, six tools and a duration.
  Every output is the true output of the command shown, run on generated data.
  The `write` row opens on the actual 57-line `match_receipts.py`, the program
  `assets.mjs` runs.
- **Phone.** On narrow screens the folder drops the path prefix and the amount
  column, and the file name wraps. Tool output scrolls sideways instead of
  wrapping.

## Assets and how they are made

Run `node blocks/alice-03-october-receipts/assets.mjs` with TMPDIR set to
scratch. It writes `r01.webp` to `r23.webp` (72 × 92 px, about 4 KB each,
96 KB in total) to `$ETUSIVU_ASSETS/alice-03-october-receipts/`.

1. An embedded, seeded `generate.py` (Python 3.12) writes the following.
   Every PDF is drawn as SVG and converted with `rsvg-convert -f pdf`
   (librsvg 2.58).
   - A one-page card statement with 26 charges, €2,247.09 in total.
   - A 1,284-message mail index.
   - 212 saved `.eml` messages with attachments. They hold 23 real receipts in
     three styles (A4 invoice, till slip, e-ticket), with delays of −1 to +3
     days and same-amount charges on different dates. Decoys: a September
     Paper Mill invoice of the same amount, Northside's price list with no
     total, Example Studio's own sales invoices, newsletters and photos.
   - The shop's `info@` Maildir, which holds the Fjord Fonts invoice.
2. It writes `MATCHER` (exported from `block.js`) to
   `bookkeeping/match_receipts.py`. It then runs every command in `RUNS` in
   order and **fails if any output differs from what the screen prints**.
   `--print` prints the actual outputs as JSON, for updating `block.js`. The
   tools are pdftotext and pdftoppm (poppler 24.02), jq 1.7 and Python's
   `email` module.
3. It renders each filed PDF with `pdftoppm -r 72`, crops the top of the page
   with ImageMagick 6.9 `convert` (the full height for the wide e-ticket) and
   writes WebP at quality 84.

`gog` (Alice's Gmail) and `himalaya` (the info@ mailbox) cannot run against
fictional accounts. Each such RUN therefore names the local command
(`run`) that reads the generator's stand-in for the same data: `jq` on the
index, `ls` on the saved messages, and the matcher on the Maildir. The `gog`
syntax follows the gogcli README (`gog gmail search --max 10 --json -- '…'`,
`gog gmail get <id> --format raw`). The `himalaya envelope search -a info
from:fjord` form follows the himalaya README (`-a` selects the account and
`from:alice` is a query).

No third-party material is used. All vendors, the bank and the domains are
invented under `example.org`.

## Assumptions about the product

- A reply card can carry an extra element below its prose. The folder list
  is drawn this way, as `offer()` and `diff()` are. A folder listing is not a
  real product component; it is drawn in this block.
- The statement's attachment meta is now "Card statement · 1 page", matching
  the generated PDF.

## For Jari

- `alice-07-lunch-phone` imports `RUNS` from this block's `block.js`, so the
  lunch screen prints the real second-pass output (`RUNS.fjord`). This
  block's `assets.mjs` verifies it.
- The sidebar line "3 charges not found" (owned by `alice-day`) still fits.

## Engine needs

None. A product-like folder/file-list component in the kit would let other
blocks show "files written" the same way.
