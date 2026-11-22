# Selain card, conversation-row mark and Oma selain row

Implemented round 3's direction 2 Kortti in production, behind the existing
`remote-browser` experiment. No contract, daemon, CLI or authorization
change.

- **In the conversation:** one Selain card under the turn that used the
  browser, in Muutokset's card shape (`components/ServerBrowser.tsx`
  `BrowserTurnCard`, fed by `app/TurnBrowserSource.tsx`). It is *Selain nyt*
  with Katso while the turn works; highlighted with the agent's request,
  **Ota ohjaus ja hoida** and Katso ensin while the request this turn made is
  open on the host; Avaa and **Anna takaisin** while the person controls;
  and the visit record once done. It opens to the accepted list (pages by
  site, downloads, actions, *Sinä selaimessa* span, coverage note). After a
  give-back Habitat's line *Annoit selaimen takaisin HH.MM* follows the card.
  `AgentTurn` got a `browser` slot shown both while the turn runs and after.
  The chip and strip above the composer, their window pictures and the
  picture polling are removed; another conversation shows nothing.
- **The conversation's rail row:** `AgentNavItem` shows the browser mark in
  the time's place (window icon + *selain* when waiting, quiet window while
  its agent works there, person + *ohjaat* while the person controls) and
  adds the state to the row's description. The marks come through the
  `BrowserRowMarks` context from `app/browserConversations.ts`.
- **Oma selain:** a plain row like Tuotokset (`BrowserRailRow`), with its
  short state at the end (*1 ikkuna*, *agentti · 2 ikkunaa*, *odottaa
  sinua* pill, *sinä ohjaat*, *ei auki*). Its accessible name names the
  asking conversation when one is linked.
- **Icon:** `Icon.tsx` has a new `browser` window icon, used by all three
  places; Tuotokset keeps the globe. The icon round replaces it there.

Linking follows round 2's decision: `turnBrowserVisits` now also returns,
for the owner only, the windows the turn's commands acted in (each result's
`tab`) and the request it left open (`agent browser request`'s own result).
The rail learns the same from every conversation's live stream
(`ToolReport` now carries the call's arguments and output) and from the
opened conversation's derivation. An unattributed request stays the rail's
Oma selain alone.

## Decisions for later review

- **The window → conversation link is view state of the tab.** It lives in
  memory like the editor's notes; nothing is stored. After a reload a
  conversation's rail mark returns when its agent's next browser command
  arrives on the live stream or its history is read (opening it). Oma selain
  always shows the request. Alternatives: the host reporting a conversation
  id (rejected in round 2: a second record of the work), or reading the
  history of candidate conversations in the background on every unlinked
  request (more reads for a rare reload case). Chosen as the least new
  machinery; revisit if the lost mark after reload is noticed.
- **A request is told from a status read by the command text.** `agent
  browser request` and `agent browser status` return the same status, so the
  derivation matches `agent browser request` (and `--clear`) in the bash
  command, and takes the window and text from the result. Alternative: the
  CLI adds `browser_action: "request"` to its result, which would need a Go
  CLI change and would not cover existing histories.
- **The give-back line and the *Sinä selaimessa* span are this tab's
  observation** of the control change (sheet, card or idle return), kept in
  memory and gone after a reload. A lasting line would need the daemon to
  write a conversation line, which is an architecture change.
- **One card per turn**, as the accepted visit record says. After a
  give-back the asking turn keeps its own record and the agent's next turn
  gets its own card; the prototype showed one merged record at the end.
- **Participants** see the summary card only: never a live state or a button
  (their browser status is their own browser, not the owner's), not
  expandable, and no block reads: only complete history-page previews are
  read, so a cut envelope is not counted for them.
- **Explain cards B01–B03** now describe the Selain card, the row mark and
  Katso; B04/B05 also cover the card's take and give-back buttons.
- **The window-picture route** (`/api/v1/browser/window`) has no web caller
  any more; the gateway and daemon route stays until someone decides to
  remove it (direction 3 Ikkuna, which would use it, was not chosen).
- **The phone's menu badge** for a request was not added; the round assumed
  the existing `navigationBadge`, which counts the conversation's own turn.

## Verification

Based on `883078d0`; rebased onto main once (conflict in
`components/ServerBrowser.tsx` with `server-browser-one-bar`, resolved by
keeping both) and all checks re-run on the rebased tree. Private TMPDIR under
the scratch lease, `umask 077`, bounded runs.

- `./scripts/test-focused.sh --area web`: passed; 250 files, 2038 tests
  (new: `ServerBrowser.test.tsx`, `browserConversations.test.ts`, two
  derivation cases), biome and tsc clean. Catalog-review tests pass (part of
  the vitest run).
- `./scripts/test-focused.sh --area browser --spec server-browser.spec.ts`
  with `OH_BROWSER_WORKERS=2`: 11 passed. The rewritten case drives fake Pi's
  saved browser CLI results and the fixture host's request through ask →
  take control → give back → record, checks the rail row mark and Oma selain
  state at each step, the 90 px height, axe on the card, that the record
  hides the URL query, and that another conversation shows no card while the
  first one's request is open.
- `--lab --spec lab-explain-coverage.spec.ts`: 12 passed.
- `test/browser-host` (fake Pi turn `selaimen käynti`): `go vet` and gofmt
  clean, built by the browser run. Not run as `go test`: the focused runner
  takes only `internal/` and `cmd/` packages.
- Synthetic, host-backed evidence only: no real Chrome, VNC or agent, and
  the live *Selain nyt* state is covered by unit tests, not a browser run.
  `scripts/generate-ui-reference.py` refreshed the shipped references
  (including drift already on main).

Evidence (screenshots and logs, not committed):
`/var/tmp/agent-keep/server-browser-card-impl/`.

## Review

Focused self-review. The diff changes no contract, daemon state, session
or authorization boundary, and implements the accepted owner/participant rule
without changing it (participants make no owner block reads), so no
independent `/llm-review` was run.
