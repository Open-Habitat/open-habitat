# Result: a fired wake leaves the rail row, and the conversation says it woke

Delivered on 2026-11-24, run `01m87j58n42k43jpcncyva1axb`.

## Rail row

The clock in the row's time slot came from two sources. One was a pending
wake. The other was a deliberate "woken" variant: an unread reply that a
wake had started showed the fire time with the same clock (snapshot
`last_wake`, `wokeAt`). That variant is what showed "21.20" at 21.46. Both are
changed:

- The woken variant is removed from end to end: `wokeAt` in `railNow.ts` and
  `Navigation.tsx`, its CSS and text, the snapshot's `last_wake` projection
  (`snapshotWakes` now returns only pending wakes), and the
  `agent-wake.schema.json#/$defs/fired` schema it used. Nothing else read it.
- The row shows a clock only while `wakeAt > now`. A wake whose moment has
  passed but that is still pending (firing, or late because the daemon was
  down) gives the slot back to the row's age.

Without hover, a pending wake's meaning is in the row's accessible
description ("Odottaa herätystä ti 24.11. klo 21.20"). The conversation's
wake bar shows it as visible text at the foot of the conversation, phone
width included (the existing spec measures it at 390 px).

## Conversation line

The conversation already had Habitat's line for a fired wake
(`WakeLineMarker`, from the `oh-scheduled-wake` native message). A seeded
native history shows it between the reply that set the wake and the woken
reply. Its wording ("Ajastettu herätys … Agentti asetti sen …") did not say
that Habitat had woken the agent. It now reads as one sentence after the
bold name: "Open Habitat herätti agentin ti 24.11. klo 21.20. Agentti oli
asettanut herätyksen …", with the note below it. A late wake reads "herätti
agentin vasta …, vaikka herätys oli ajastettu …".

Not verified: why the reported conversation showed no wake at all. This run
had only the report to go on. The line renders from a fired wake's native
message, both live and from history; the likely explanation is that the old
wording did not read as a wake.

## Evidence

- Unit tests (failing first against HEAD, passing now):
  `Navigation.test.tsx` "shows a clock only for a wake still ahead, and says
  it without hover", and both cases in `ScheduledWake.test.tsx` "Habitat's
  wake line". `railNow.test.ts` covers that a fired wake leaves the row.
- Browser: `scheduled-wake.spec.ts` "a fired wake is Habitat's line in the
  conversation, not a clock on the row" uses a new fixture history,
  `/fixture/history?mode=wake-fired` (`test/browser-host/wake_history.go`),
  at 1280 and 390 px, with axe. All 3 specs in the file pass.
- `test-focused.sh --area web` (2234 tests), `--area go --go-package
  ./internal/daemon`, and `--area contracts` all pass, run under umask 077.
  Generated contracts and UI references were regenerated. The UI-reference
  run also picked up earlier drift from main for OfferPanel/explainMode.
