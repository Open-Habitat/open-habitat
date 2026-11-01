# Result: public switch, Kopioi linkki and the durations menu

ADR 0035 unit 4, built on units 1–3. Browser-only: no gateway, contract or
daemon change.

## What landed

- **The card** (`web/src/components/ViewOffer.tsx`) is the accepted
  r2-B/r3-A design: the title row carries a *Julkinen* switch (react-aria
  `Switch`); one press publishes for `min(30, max_days)` days counted from
  now (republishing starts again from 30). While public, the date (*1.12.
  asti*) sits left of the switch and opens the lengths the site allows (1, 7,
  30 and the maximum, each with the day it would end; the current one ticked),
  and *Kopioi linkki* copies the stable entry address. Gone: *Agentti tarjoaa
  näytettäväksi:*, the *Jäädytetty HTML · … · Vain sinulle* line, *Avaus
  pyydetty…*, the share dialog and its revoke-does-not-recall sentence. No
  expiry notice: an expired view simply shows the switch off. On a narrow card
  (container < 460 px) the date and switch take their own line under the
  title. A site with sharing off shows neither switch nor copy; private
  opens still work.
- **One destination.** *Avaa omalle välilehdelle* opens the view's stable
  address when the store knows it (private: owner frame; public: redirect to
  content), else the `/view?id=` launcher, which reserves and replaces itself.
  The copy buttons copy the same `url`, never `content_url`.
- **Panel** (`ViewPanel.tsx`): the link icon became a copy icon shown only
  while the view is public and its state is known; the note keeps only the
  isolation sentence.
- **Owner-scoped shared state** (`web/src/app/viewLinks.ts`): all cards, the
  panel and Settings read one store, reset (new epoch) on account change.
  Per-view marks: `busy` while a write is on its way (every card of the view
  waits; a second press is refused, never queued) and `uncertain` after a lost
  reply, 5xx or unreadable reply, which is settled only by a list read started
  after it — never by resending. A list read that started before a write
  keeps the written address (or its deletion). A failed list read marks the
  state unknown (switches read-only, copy hidden, Settings says *Tilaa
  tarkistetaan…*) and is retried by itself with backoff; the list is also
  re-read on focus/visibility and just after the earliest publication ends,
  and that redraw happens even if the read fails, so an expired view never
  shows as public.
- **Settings › Tili › Näkymien osoitteet** (`ViewLinkSettings.tsx`) lists every
  reservation (public first, then newest): private, public, expired, paused,
  and those whose export no longer exists. Each row opens the address, copies
  it while public, makes it private, and deletes it for good behind a
  confirmation dialog. The list and deletion work with sharing off.

## Screenshots

Device scale factor 2, synthetic lab host with views (same-UID), made by
`web/lab/view-card-public-switch.spec.ts` (`npx playwright test -c
lab/view-card-public-switch.config.ts` from `web/`). HTML snapshots sit beside
the light variants; dark variants share their DOM.

| State | Desktop light | Desktop dark | Phone light | Phone dark |
|---|---|---|---|---|
| Private | [kuva](shots/private-desktop-light.avif) | [kuva](shots/private-desktop-dark.avif) | [kuva](shots/private-phone-light.avif) | [kuva](shots/private-phone-dark.avif) |
| Public | [kuva](shots/public-desktop-light.avif) | [kuva](shots/public-desktop-dark.avif) | [kuva](shots/public-phone-light.avif) | [kuva](shots/public-phone-dark.avif) |
| Durations menu | [kuva](shots/durations-desktop-light.avif) | [kuva](shots/durations-desktop-dark.avif) | [kuva](shots/durations-phone-light.avif) | [kuva](shots/durations-phone-dark.avif) |
| Panel, public | [kuva](shots/panel-desktop-light.avif) | [kuva](shots/panel-desktop-dark.avif) | | |
| Settings list | [kuva](shots/settings-desktop-light.avif) | [kuva](shots/settings-desktop-dark.avif) | | |
| Permanent delete | [kuva](shots/settings-remove-desktop-light.avif) | [kuva](shots/settings-remove-desktop-dark.avif) | | |
| Sharing off on the site | [kuva](shots/sharing-off-desktop-light.avif) | | | |

## Tests

- `scripts/test-focused.sh --area web`: 1205 tests. New: store tests for a
  stale read not undoing a write, a second change refused while one is in
  flight, expiry redraw even when the read fails, self-retry of an unknown
  list; ViewHost tests for one-press publish (ensure + publish 30), two cards
  of one view sharing state, the tab and copy using the entry URL, the
  durations menu, and a 502 publish settled by re-reading with exactly one
  write; Settings test for the full inventory with sharing off and
  confirm-before-delete.
- Browser (`OH_PORT_BASE=10330`, 2 workers): `view-links.spec.ts` rewritten
  for the switch (recipient reads via the entry address, private again → 404
  on content, republish revives the same link, duration change, the card's
  own tab follows the public address, Settings deletion ends the address even
  for the owner and the next own tab gets a new one), plus `agent-views`,
  `ui-language-views` and `worker-view`. All pass.
- `scripts/test-ui-reference.py`; regenerated UI references.
- Review: independent `/llm-review` (finder claude-fable-5-1, verifier
  gpt-6-astra) and `/assess-findings`: 3 FIX, all applied — a confirmed delete
  dropped silently while another write was in flight, an unknown list never
  retried in a focused tab, Settings offering copy while unknown.

## Decisions for later review

- **Four lengths, no tick unless the date matches.** The menu ticks the
  length whose resulting day equals the current end; a publication whose end
  matches none shows no tick. Alternative: remember the chosen length (a new
  per-person preference the ADR avoids).
- **The date button has a surface.** The design system gives every
  text-labelled button a tinted surface (buttons-no-surface), so the date is
  not the prototype's bare text. Alternative: a new transparent variant.
- **Durations open as an anchored menu on phones too**, as drawn in the
  prototype, not as the bottom sheet `ChoiceMenu` uses.
- **Unknown state locks the switch rather than guessing.** A failed list read
  keeps the last known position visible but read-only, hides copy, and retries
  by itself (5 s doubling to 60 s). Alternative: keep the stale state usable,
  which would let a press act on a wrong observation.
- **A second press while busy is refused with a message, not queued.**
  Queuing would reorder or merge the person's intent invisibly.
- **Permanent deletion uses a confirmation dialog.** The ADR rules out new
  confirmations on the card; deletion in Settings is irreversible, so it asks.
- **Settings row renamed *Näkymien osoitteet*** (was *Jaetut linkit*), since it
  now lists private addresses too; the administrator's list keeps its name.
- **Phone layout by container width** (< 460 px card) rather than viewport,
  so a narrow conversation beside an open panel gets the same layout.
- **Screenshot HTML only for light variants** to keep the issue folder near
  7 MB; each dark image has the same DOM as its light pair.

## Remaining gaps

Real ingress, separate Unix users and anonymous recipients across the
network are unit 5 (`view-address-end-to-end`).
