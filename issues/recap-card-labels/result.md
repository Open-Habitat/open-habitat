# Result

The recap card ("Tilannekatsaus") no longer shows "luotu automaattisesti",
"uusia viestejä" or "ajantasaisuus ei tiedossa", and the home card lost its
"uusia viestejä" badge. A recap is shown only while it covers the latest
native message and, in a controlled conversation, while no turn is running
(`currentRecap` in `web/src/app/conversations.ts`). The conversation view,
the read-only history view and the home card all use it.

The daemon already regenerated a recap after every settled turn once the
conversation had been idle for three minutes, whatever the previous recap's
trigger; no daemon or contract change was needed. The new unit test
`TestOutdatedAutomaticRecapIsRegeneratedAfterNextIdle` pins that a later
settled turn earns another automatic recap. The host-backed
`lab-conversation.spec.ts` recap journey now opens the conversation in a
second browser context that never dismissed the recap: it shows no card
during the second turn and the new automatic recap afterwards, live.

Evidence: `./scripts/test-focused.sh --area web` (742 tests), the daemon's
recap tests under `-race -count=5`, and the touched browser specs
(`lab-conversation`, `lab-workspace-page`, `lab-composer-focus`,
`process-tray`, `browser-conversation`, `phone-composer-keyboard`) green.
Not covered by a host test: the manual recap's request card (below), because
the synthetic host always produces an automatic recap first.

## Decisions for later review

- **Outdated automatic recap: hidden, not shown as refreshing.** The browser
  cannot see the daemon's idle timer or its in-flight automatic call, so a
  "being refreshed" state would be a guess for up to three minutes. The card
  disappears and the new recap appears when Pi writes it. Alternative: expose
  the daemon's recap schedule in the status contract to show a skeleton.
- **Outdated manual recap: the card stays as an empty request** ("Luo
  katsaus" with the refresh button, disabled while the agent works), but only
  in a controlled conversation where a request is possible. Its old text is
  not shown. The daemon still replaces it automatically after idle.
- **A running turn outdates the recap** in the conversation view (controlled
  state not idle) and on the home card (activity "working"), as the old badge
  did.
- **"ajantasaisuus ei tiedossa" removed.** Its case (a failed recap re-read
  after an earlier one) still exists, but the inline alert "Katsausta ei
  voitu tarkistaa…" already says it; the badge was a duplicate.
- **Terminal (read-only) histories** get no regeneration from the daemon, so
  an outdated recap there now shows the empty card instead of the old text.
- **`data-trigger` on the card** replaces the removed label's test id as the
  stable hook for "an automatic recap arrived" in browser specs.
- `design-system/design.md` now describes this; the designer's drafts and
  prototype library still draw the old badges.
