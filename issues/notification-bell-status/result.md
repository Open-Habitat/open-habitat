# Result: the status bell (Tila)

The three strips above the shell (storage, new version, GitHub connection)
are gone; `ConnectionBanner` and the demo banner stay in the `connection`
slot. `StatusBell` (`web/src/components/StatusBell.tsx`) is present only
while a condition holds, counts what holds, swings once on an arrival, and
turns into a red pill with the item's words when something is serious. Its
panel lists each item with its own action; nothing is dismissed except the
version's existing *Myöhemmin*. The items are computed in
`web/src/app/statusItems.tsx` from facts the browser already read, plus the
administrator's existing `GET /api/v1/server/storage`. No store, no seen
state, no new host surface.

Evidence: `web/tests/status-bell.spec.ts` (desktop and phone, light and dark,
axe on the bell and panel, Esc returns focus, one bell per screen, the
administrator's group and its resolution, single-workspace mode, and no
server read for a non-administrator), plus the rewritten
`quota-pressure.spec.ts`, `github-connection-warning.spec.ts` and
`server-version-reload.spec.ts`.

## Decisions for later review

- **Where the bell sits on desktop pages without a top bar: the rail's
  Etusivu row.** The prototype put it in each page's own head. Etusivu,
  Asetukset and Uusi työtila have no shared head, and Asetukset was being
  changed by another worker. The rail row is the same place on every such
  page. In a conversation the bell is in the conversation's top bar before
  Tiedot, as prototyped; in single-workspace mode it is in the top bar; on a
  phone it is in the toolbar or the conversation's top bar. Alternative: add
  it to every page head, the workspace page's included. The cost is that the
  bell moves from the rail to the conversation's top bar when a
  conversation opens.
- **The bell also shows the GitHub warning on Uusi työtila and
  Koodipalvelut.** The old strip was suppressed there because those pages say
  it in place. The bell is one button, not a second strip, and it is an
  account-wide condition.
- **The GitHub warning's host-retry progress and the reconnect confirmation
  are no longer shown outside a conversation.** Neither is a condition that
  needs the person. Both still show above the composer. Alternative: a quiet
  bell item while the host retries.
- **No time on the items.** The host does not say when a condition began, and
  "the time the browser first saw it" would be per-tab state with no meaning
  across reloads.
- **The administrator's overcommit is read once a minute and right after a
  limit change made in this tab.** The role is read again on navigation, as
  the rail does. Only a known overcommit is shown; `overcommitted: null`
  (a limit could not be read) is not.
- **Warning tone is neutral, info is accent, danger red**, as in the
  prototype. GitHub *disconnected* and *unreachable* are warnings and
  *expired* is danger, following the existing warning tones.
- **On a phone the pill's words are cut at 92 px.** In single-workspace mode
  on a phone the workspace name then shrinks to its icon while something
  serious holds.
