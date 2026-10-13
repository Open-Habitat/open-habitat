---
created: 2026-10-13
updated: 2026-10-13
type: bug
status: fixed
priority: normal
lane: web
lane_seq: 19
collision: [web/]
closed: 2026-10-13
closed_by: claude
---

# Old-conversation top bar and info popover details

Jari, 2026-10-13 on the test server, the top bar and its info popover of an
old conversation (screenshots in the conversation of 13.10.):

1. The chips "Prosessin tila ei tiedossa" and "Vain luku" have much less
   padding on the right than on the left.
2. The info popover does not follow the draft's details popover
   (`design-system/prototypes/lib/app.js` `detailsList`: Työtila, Malli,
   Ohjaus, Aloitettu, Natiivi tunniste as an aligned definition list). It
   repeats "Vain luku · Ohjausta ei ole" already in the bar, and shows lines
   "Uusi otsikko: Vain luku · Ohjausta ei ole." and "Arkistointi: Vain luku ·
   Tätä keskustelua ei voi arkistoida." whose meaning is unclear and whose
   vertical alignment is off. Disabled reasons belong to the disabled
   buttons (tooltip and accessible description), not as loose text lines.
3. The popover (or the bar) should show the model and thinking level.
4. The state chip "Odottaa" reads "Odottaa sinua", as in the draft's sidebar
   states.
5. An old conversation older than three idle minutes shows no Tilannekatsaus
   card above the composer area; the recap should exist for it too
   (`design-system/design.md`, Tilannekatsaus paragraph).

## Done when

- Bar chips symmetric, popover matches the draft's facts list with model and
  thinking level, no duplicated or loose reason text, "Odottaa sinua", and a
  recap card on an idle old conversation; light and dark, desktop and phone.
- Lab evidence beside the draft in this folder, differences in `result.md`.
