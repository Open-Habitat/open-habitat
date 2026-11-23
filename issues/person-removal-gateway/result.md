# Result: gateway and CLI person removal

Administrator operations: `POST /api/v1/server/access/remove-person {id, login,
when}` and `/cancel-removal {id}` from a browser administrator session, and
root's `open-habitat admin access remove-person --github-id --login [--now]` /
`cancel-removal` over the control socket. Order: removal record + deny
(one commit) and sessions, view addresses and shares removed; the person's
own daemon disconnects their services (`done` with counts, or `not_reached`);
the broker schedules. Each step repeats safely; a repeat continues from the
record. Self-removal, a `site.json` person and a `site.json` administrator
are refused; the typed login is checked against the subject (broker hint,
record, or GitHub's current login for the id, case-insensitive). Access rows
carry `removal` (scheduled/removing, due, actor, at, held reason, provider
counts); the storage read carries `removal_due` and counts usage instead of
the limit in the sum (this is what fixes the original report). When the
broker no longer has the binding, the gateway drops the onboarding receipt,
designation, site key copy entry, deny and the record, on the next access
list, admission or sign-in of that id.

Checks: focused Go for `./internal/gateway` and `./internal/cli`; contracts
regenerated and `--area contracts` green.

## Decisions for later review

- **No "Poistettu" record, no `--state removed`, no clear action.** The issue
  asks for them, but Jari's 21.11. decision on ADR question 4 was that the
  record stays only as long as the person can still be restored; after final
  deletion the row goes. The record also goes on cancel. `admin access list
  --state removing` lists scheduled and running removals instead. The broker
  journal (`broker_removal`) keeps the audit.
- **The entry's `state` stays `withdrawn`; removal is a `removal` object**
  (stage `scheduled` for the broker's closing/closed, `removing`), rather than
  new states `removal_scheduled`/`removing`. A removal is a withdrawn person
  with more on top; filters and restore logic keep working on `state`.
- **The daemon is reached through the broker's `authorize`**, which the
  gateway's own deny does not affect, so the disconnect runs after the deny
  but while the broker still routes the person. A person already withdrawn
  has no running daemon: `not_reached`.
- **A definite broker refusal after the disconnect** drops the record, and
  the deny unless the person was already withdrawn; services stay
  disconnected (the person reconnects them).
- **Settling a finished removal happens on reads** (access list, admit,
  sign-in), not on a timer: those are the only places where the leftover
  deny or receipt matters.
