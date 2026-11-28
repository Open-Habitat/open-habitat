# Tulokset

Osion ensimmäinen prototyyppi on keskustelulinkkien kierroksella 2:
`conversation-links-prefilled-draft`-issuen `result.md`, kohta "Kierros 2".

## Jari 28.11.2026: approved for implementation

Section *Vaaralliset toiminnot* as in conversation-links round 3 (calm card,
rows, *Salli…* with a warning dialog, off immediately), per person, default
off, only the person in the browser can switch it on (not the agent CLI). The
first and only member for now: conversation links.

## Implemented (testing)

Settings › *Vaaralliset toiminnot* (`/settings/risky-features`, shield icon,
right after Avaimet) with one member, *Keskustelulinkit*
(`conversation-links`), as the round 3 prototype shows: one card, the row's
name, one line, the state word, one button (*Salli…* / *Poista käytöstä*),
the always-visible *Sallii:* sentence, and while on a soft danger edge and
*Sallit tämän … klo …*. *Salli…* opens the warning window (*Kun tämä on
päällä*, *Ei koskaan*, all devices); focus starts on *Peru*, and Esc, a
press outside and *Peru* leave it off. *Poista käytöstä* is immediate.
`/settings/risky-features#conversation-links` focuses the row.

Storage and authority: the choice lives in the person's account preferences
(`risky` in `contracts/v1/account-preferences.schema.json`), written by
their daemon with the time it was first allowed; the browser reads it with
the other preferences and `useRiskyFeature(id)` gives the next issue its
switch. Only the browser's `/api/v1/account/preferences` route (gateway
session + CSRF) writes it. The agent listener has no route for it, and
`agent experimental update conversation-links` and the agent experimental
route refuse the id. No new authority code: the browser-only write is the
existing gateway route, so no `/llm-review` was run.

Limits, stated plainly:

- The agent runs as the person's Unix user, so it can still edit the
  preferences file itself, as it can any of the person's files. The switch
  removes the documented route an instruction could ask the agent to use; it
  is not a boundary against an already compromised agent.
- Administrator: no existing mechanism makes the section's members
  unavailable on a server, so none was added. A site switch that forbids
  (never enables) a member would be a new admin setting.
- The agent can read the state only from the file; no `open-habitat agent`
  read command was added (the links issue can add one with its guide text).

Evidence (synthetic hosts only), on this branch:

- `./scripts/test-focused.sh --area go --go-package ./internal/daemon`,
  `--go-package ./internal/gateway`, `go test ./internal/cli -run
  TestAgentExperimental`: pass. New: `TestAccountPreferencesRiskyFeatures`
  (default off, strict writes, first time kept, off removes the key, retired
  id reads as off), `TestAgentListenerCannotAllowRiskyFeature`.
- `./scripts/test-focused.sh --area contracts`: pass (new positive and
  negative cases for `risky`).
- `./scripts/test-focused.sh --area web`: pass.
- Browser: `settings-risky.spec.ts` (allow through the window, Esc and
  *Peru* write nothing, focus stays on the row's button, off at once, reload,
  another device by deep link at 390 px, agent refusal, failed save, phone
  window fits, control spacing, axe), also with `OH_REPLY_DELAY_MS=250`;
  `settings-search`, `settings-experimental`, `settings-close`: pass.
- Looked at 1440 and 390 px in light and dark in the synthetic host;
  screenshots were not committed.
