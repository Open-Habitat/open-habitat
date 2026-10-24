# Result

## Integraatiot rows

Each row is its own CSS grid. Its columns were
`auto minmax(0, 1fr) minmax(0, 240px) 150px`. In a narrow settings pane the
status column took its full 240 px before the name column got any width.
The name column could shrink to zero, so the name overflowed under the
status. The columns now never go below their content (`minmax(min-content, …)`)
and the name does not wrap. The row responds to its own container
(`container: si`) rather than to the viewport. Below 640 px of pane width the
status moves under the name, and below 420 px the action button gets its own
line. `server-integrations.spec.ts` asserts with bounding boxes at 1366 and
390 px that name, status and action never intersect, stay inside the row, and
that the name is one line. On the old CSS it failed for all six rows at
1366 px.

## Login instead of GitHub id

The broker keeps a `login_hint` only for runtime (`site_admin`) entries.
Operator entries from site.json, Jari's own row among them, and a deny with no
broker row came without a login. The browser labelled those rows
"GitHub-id N".

The gateway's access list (and a single changed entry) now fills a missing
login through the same app-authenticated GitHub users API (`LookupID`) that
admission already uses. Up to four lookups run in parallel under one 5-second
deadline for the whole list. Nothing is stored: a GitHub login can be renamed,
and the list is read only when the tab opens. No authority moved; the gateway
already calls this API as the OAuth app.

The row's label is the login. The numeric id is a tooltip. When the lookup
fails (GitHub unreachable), the row says the username is not available and
shows the id beside it as the distinguishing detail.

## Decisions for later review

- Logins are looked up on every list read, not cached. With a handful of
  operator rows this is a few GitHub calls per tab open, well within the
  OAuth app's rate limit. A cache would be a second record of the login that
  goes stale after a rename.
- A row whose login cannot be resolved reads "GitHub-käyttäjätunnus ei
  saatavilla", with the id in the facts line. The remove dialog and the remove
  button's accessible name still use "GitHub-id N" for such a row, where
  the id is the only identifier.
- No lab screenshots: the Alder runner refuses lab mode. The evidence is the
  bounding-box assertions and the new `UnresolvedLogin` story.
