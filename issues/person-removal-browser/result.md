# Result: browser person removal flow

Built to direction 1 Armonaika of the 21.11. prototype round, as Jari chose
(the row shows the date; confirmation as built):

- Käyttäjät ja pääsy: "Poista henkilö" beside "Poista pääsy" on a joined row
  and beside "Palauta pääsy" on a withdrawn one; never on root's people or
  administrators. The dialog states the consequences in the person's terms
  (access and sessions end now, services are disconnected now, shared links
  stop now, the home with its size is deleted for good on the date, or at
  once), reminds that Habitat does not tell the person, offers Milloin
  (14 days, default, or Heti), and is confirmed by typing the GitHub login
  (case-insensitive, `@` allowed). The confirm button names the outcome
  ("Poista 5.12." / "Poista heti").
- A scheduled removal shows "Poistetaan pp.kk.", the note that access is
  closed and services disconnected, the services' counts, and "Peru
  poisto"; a removal whose data stage has begun has no undo; a held one shows
  "Poisto kesken" with its reason and that the server retries hourly.
- Levytila: the row shows "Poistetaan pp.kk.", its use, "Ei varaa rajaa:
  lasketaan käytön mukaan" and no limit stepper; the sum of limits counts its
  use. The row goes when the data is deleted.

Checks: `./scripts/test-focused.sh --area web` (all 257 files);
`OH_BROWSER_WORKERS=2 ./scripts/test-focused.sh --area browser --spec
server-access.spec.ts --spec settings-name-and-storage.spec.ts` (7 passed),
including a new spec for grace removal, undo, immediate removal and Levytila.
The spec found the gateway's missing routes (fixed in its own commit).

## Decisions for later review

- **No "Poistettu" rows and no clear action**, following Jari's decision that
  the record goes after final deletion (the prototype round still showed them).
- **No "N pv jäljellä"** on the row: Jari chose the date only.
- **No "Yritä nyt" button.** The round proposed one beside the hourly retry.
  The broker repeats a held step hourly; a manual retry would need a new
  broker trigger. The operator can repeat with `admin access remove-person
  --now`, which continues the removal.
- **No step list on the row.** The round showed six named steps; the broker
  reports a stage and a fixed reason, and the row shows those. Naming steps
  the host does not report would be a second description that could drift.
- **"Peru poisto" is on the access list only**, not also on Levytila; the
  storage view stays a view of space.
- **The signed-in administrator's own row** gets no hidden removal action
  when they are root's administrator (as on the test server); a designated
  administrator would see the button and get "Et voi poistaa itseäsi" from
  the gateway, because the session read does not carry the GitHub id. The
  component takes `self` for when it does.
- **The dialog's date is computed in the browser** (today + 14 days); the
  broker sets the actual due time, which the row then shows.
