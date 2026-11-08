# Result

Implemented Jari's choices (Kortti, Viereen, Kulma; Oma siru, A Kuvakkeet).

- **One card** (`web/src/components/OfferCard.tsx`) for views and every file
  kind: the whole card opens the item in the right-hand panel, the same card
  closes it, the open card is highlighted (accent border and background, ›
  turns ✕ under the pointer). Corner icon row under the pointer and keyboard
  focus, always visible as the last row on a touch screen (`hover: none`).
  The same row is in the panel's top bar.
- **Files open beside**: `OfferPanel` shows a table, image, document, player,
  archive listing or facts in the panel (the old preview dialog's renderer,
  shared via `usePreview`); a folder lists its files, each opening in the same
  panel with a way back.
- **Own tab for every kind**: views as before (`/view?id=`); file offers at
  the new app page `/offer?id=…[&path=…]` (gateway SPA route).
- **Download for every kind**: files and folder zips as before; a view as a
  zip through the new owner-session route `GET /api/v1/views/<id>/zip`
  (daemon streams the frozen export, gateway relays it as an attachment with
  the file offers' sandbox CSP). Independent review (GPT-6 Astra) found two
  should-fix gaps in it (unbounded listing breadth, truncated file giving a
  shorter zip); both fixed with a regression test.
- **Assets chip and list** beside Workers in the strip above the field: view
  and file counts, list newest first, a view's versions (same entry file)
  folded under its newest, rows are links to the item's own tab (modified
  click opens the tab), plain press opens/closes beside, hover icons (publish
  for views, own tab, download, Näytä keskustelussa). The top bar's file
  button and the file panel (Hylly) are gone.

Screenshots: `evidence/` (1440 and 390, light and dark: cards, table and
folder opened beside, the list, a view beside its card).

## Decisions for later review

- **Publish icon absent for files**, not disabled: `public-file-offers` adds
  it. Alternative was a disabled globe with a reason; absent avoids explaining
  a control that does nothing yet.
- **Folders have an own tab** (file list page) although the assets prototype
  left it out; the acceptance asks for own tab for every kind and the cards
  prototype showed the folder tab.
- **The file panel (Hylly) and its search are removed**; the assets list
  replaces it. Searching across offers' files is gone; the list has no search.
- **The chip counts views by report** (versions folded) and files by offer,
  as in the prototype; a zero count is hidden (an installation without views
  shows only files).
- **Näytä keskustelussa finds only a loaded card**; for an older card the list
  says to scroll up rather than loading history backwards.
- **On a phone the list closes when an item opens** (the panel covers the
  conversation); on a desktop it stays open beside the item.
- **The panel shows type and size only when it cannot show the content**; the
  header's facts line already carries them.
- The lab capture `web/lab/view-card-public-switch.spec.ts` (closed issue
  `view-card-public-switch`) targets the old switch card and no longer
  matches; left for its issue's pruning.
