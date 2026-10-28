# Result

Settings › Users and access takes several GitHub logins at once (commas,
spaces, semicolons or newlines; Shift+Enter adds a line). The field
normalizes each name as before (`@name`, a profile URL) and drops repeats,
ignoring case. Each name goes through the same shape check, GitHub lookup and
duplicate judgement as a single name, one lookup at a time, and its outcome is
listed by name. *Salli N* then sends the allowable ones to the existing `add`
call one at a time, and each line shows *Lisätty*, *Palautettu*, the refusal,
or *Tila epävarma*. A single name keeps the old two-step flow. The browser
contract, the gateway and the broker are unchanged.

## Decisions for later review

- **Withdrawn people in a batch are restored.** Alternatives: list them as
  "already listed", or skip them. Chosen because a single name already offers
  *Palauta pääsy* for a withdrawn person, and naming someone again reads as
  wanting them back. The line says *Pääsy palautetaan* before sending.
- **Lookups and adds run one at a time, at most 100 names per batch.**
  Alternative: parallel requests. Serial keeps GitHub's lookup rate and the
  broker's writes at the pace of single adds, and each outcome stays tied to
  its name. 100 is an arbitrary bound on a paste.
- **Two logins that resolve to the same GitHub id**: the later one is shown as
  a duplicate ("Sama tili kuin @x"), never sent twice.

## Tests run

- `./scripts/test-focused.sh --area web`: 125 files, 797 tests passed.
- `web/tests/server-access.spec.ts` (2 tests) passed with a private
  `OH_PORT_BASE`; the batch replaces the old single add of Carol in the first
  test and covers found, duplicate, organisation and not-found lines.
- Review: focused self-review (UI only; no daemon, contract, session or
  authority change).
