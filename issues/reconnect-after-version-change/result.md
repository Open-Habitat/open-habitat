# Result

## Cause

The browser validates every snapshot against the contract compiled into its
own bundle (`web/src/app/snapshot.ts`), and the snapshot schema rejects
unknown properties. pilot.16 added `workspaces[].icon` and
`agents[].spinoffs_idle` to the snapshot. After the release restarted the
daemon, the pilot.15 tab's event stream had to resnapshot, and its
`GET /api/v1/snapshot` answered 200 with a body the old schema rejected
("invalid snapshot", diagnostic outcome `invalid`). The journal then reported
"Palvelimen tilaa ei saatu tarkistettua", and *Yhdistä* (`manualRefresh`)
re-ran exactly that read, which failed identically every time. The server
was reachable; only the old bundle could not read it.

## Fix

Every failed snapshot read now also checks the served bundle
(`checkBundle`, which now resolves to what that check found, or undefined
when the index could not be read). When the server served its index just now
and it names another bundle, the connection banner switches to
`version-changed`: it says the server was updated and its only action is
*Lataa uudelleen* (the same reload the bell's new-version item uses; drafts
live in session storage and survive it). The next successful snapshot read
clears the state.

Spec: `web/tests/server-version-reload.spec.ts`, "a tab whose bundle cannot
read the upgraded host offers reload, not reconnect" — a real gateway
upgrade with a new bundle; for the old document the stream answers 409
`cursor_instance_mismatch` as a restarted daemon does, and the snapshot
carries a field its schema does not allow. It asserts the
`invalid` diagnostic (the cause), the reload banner without a retry, and the
draft and a working connection after reload. It fails on the previous
`App.tsx`.

## Decisions for later review

- **Offer reload on any failed read while a newer bundle is served, not only
  on an `invalid` snapshot.** Alternatives: only on `invalid`; or compare
  contract versions. Chosen because a 5xx in the middle of an upgrade is
  followed by the same incompatibility, reloading into the new bundle is
  correct whenever the server serves one, and the contract has no version
  marker that changes with additive fields.
- **An unreachable server keeps *Yhdistä*, even if an earlier check had
  found a newer bundle.** Reload is offered only when the index was read in
  the check made for this failure, because reloading while the server is
  down replaces the page with a browser error.
- **The banner ignores the bell's *Myöhemmin*.** Dismissing the prompt
  postpones an optional update; here the tab cannot reconnect at all.
