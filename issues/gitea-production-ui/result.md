# Result

The Gitea parts of Integraatiot and Uusi työtila are now covered where the
issue asked: the connect form's error is measured whole against the viewport,
every clipping ancestor and anything drawn over it; an uncertain connect is
observed from tea's own state and never resent; a Gitea clone survives leaving
the page, is cancelled only on confirmation and retried after a refusal; and
namesakes on GitHub and Gitea stay apart by route, by workspace and when one
source fails. Jari can review the existing production components with a
synthetic Gitea in Storybook and in `evidence/`. The production change is
small: the connect form and its token are dropped when another login replaces
the session, and GitHub rows name their source once a Gitea is connected. No
contract, daemon, gateway, unit, socket or runtime dependency changed.

## What changed

- **Session change** (`web/src/app/IntegrationsSettings.tsx`). A changed
  CSRF binding means another login. The Gitea dialog, its typed token, a
  disconnect confirmation and the check results are dropped, so a reply that
  arrives for the previous session no longer leaves a "Tarkistetaan…" dialog
  that cannot be closed. Replies after a session change were already ignored.
- **Origin on every row of the common list** (`ClonePage.tsx`,
  `NewWorkspacePage.tsx`). The approved round 3 ("Yhteinen lista") names each
  row's source, GitHub included. When a Gitea is connected, GitHub rows and
  owner sections now carry a `github.com` chip like the Gitea ones. A row
  inside an owner section leaves the chip to the section heading. Search hits,
  "Viimeksi päivitetyt" and the lookup keep it on the row. The header and the
  tab say "GitHubista tai Giteasta" while a Gitea is connected, even when its
  list failed.
- **Synthetic Gitea controls** (`test/browser-host/gitea.go`).
  `/fixture/gitea?action=hold|release` holds every Git transfer (a slow
  clone). `fail|recover` makes the API answer 500 to the fixture's token (an
  unwell server whose source fails alone). One lock serializes holds and
  releases (review finding).
- **Storybook**: `Production/Gitea` covers the connection cards (usable, Git
  not set up, foreign helper, OAuth, duplicate, check rejected, not offered,
  unreadable tea file) and every dialog stage, including the 390 px phone with
  help open, uncertain, replace and disconnect. `Production/Uusi työtila ·
  Gitea` covers the common list with failed and incomplete sources, a
  three-way same-name search, Gitea details (ready, workspace, origin unknown,
  empty, refused start), the GitHub namesake taken by the Gitea clone, and
  Gitea jobs (running, failed, interrupted with and without its connection).
  Fields hold only made-up text.
- **Review material**: `evidence/` holds synthetic-lab screenshots with
  adjacent static HTML from `web/lab/session.mjs` `snapshot`. They show the
  form error at 390×568 (light and dark), connected, the cards, the common
  search (desktop light and dark, phone), the browsed list, Gitea details, a
  running Gitea job and a failed source. `capture.mjs` regenerates them against
  `scripts/lab.sh start`.

## Validation

Go and browser runs used `umask 077`, TMPDIR under `/var/tmp`, synthetic homes
and the loopback TLS Gitea with real Git.

- Unit (`test-focused.sh --area web`: 116 files, 740 tests, then the touched
  files again after review):
  - `IntegrationsSettings.test.tsx`: a lost reply and a 502 both end
    uncertain, reread the list, show the connection the write made and send the
    token once. A session change closes the pending form. That case fails with
    the reset removed.
  - `GiteaConnection.test.tsx`: the token is gone after form → uncertain →
    form. It fails if the token is cleared only on `done` (review finding).
  - `NewWorkspacePage.test.tsx`: route switches between the same id on two
    servers and GitHub select exactly the named source; an unknown connection
    selects nothing. One failed source is reported beside healthy lists; a
    failed Gitea read leaves GitHub's list. Two accounts are told apart in
    sections and in search.
  - `cloneJobs.test.ts`: a lost Gitea start reply, or one naming another
    repository, is never taken as the clone and never resent; the list shows
    the job.
- Browser (Fleetrepo-routed runner):
  - `integrations.spec.ts` 10/10. The Gitea error's rectangle is checked
    against the viewport, every clipping ancestor and `elementFromPoint`
    inside its border radius. Moving the error into the scrolling body
    (Jari's round-2 complaint) fails it as "clipped by ig-gitea-body, covered
    by ig-gitea-foot". The uncertain connect drops the reply after the request
    reached the daemon. The card appears from tea's state and exactly one POST
    is sent. The keyboard case runs in dark with reduced motion: Enter submits
    from the address field with https:// added, each refusal takes focus and
    is whole at 390×568 with help open, the address, token and `code` have no
    ligatures, nothing in the dialog animates, axe finds nothing, and Escape
    returns focus to the opener.
  - `clone-page.spec.ts` 11 passed plus the existing opt-in visual skip. The
    new Gitea cases: hold → running job → elsewhere → reload → back through the
    rail → cancel with confirmation → refused start while the server fails →
    retry → confirmed; and GitHub vs Gitea `fixture/first` by route, then
    cloning the Gitea one makes the GitHub row `taken` with no clone action,
    and a failing Gitea leaves GitHub's rows with a failed source note.
  - Whole ordinary suite (`test-focused.sh --area browser`): 374 passed,
    3 skipped, 0 failed, including `github-first-onboarding.spec.ts`.
- Storybook build (`npm run storybook:test`) passed.
- Review: `/llm-review` used gpt-6-astra as finder and claude-fable-5-1 as
  verifier, followed by `/assess-findings`. Both findings were confirmed and
  fixed: the fixture hold race, and the missing uncertain-token test. Neither
  is reachable in the product. No finding touched the token's path.
- Full gate (`ci-local.sh --clean --json`) on `185dde73` passed clean in one run, with web checks, Storybook, Go/contracts, both browser suites and packaging. A receipt was written for tree `3c9192f4`. This line is the only change since.

Not run or not proven: no real Gitea, real tea, distinct kernel UIDs or
installed release; same-UID fixtures prove routing and presentation only.

## Decisions for later review

- **GitHub rows get a `github.com` chip when a Gitea is connected.** The
  approved round names every row's origin; production only marked Gitea rows,
  so GitHub was "the unlabelled one". Without a Gitea the page is unchanged.
  The alternative was a word ("GitHub") instead of the host; the host matches
  the Gitea chips, which show the server as typed.
- **Rows inside an owner section no longer repeat the section's chip.** This
  also changes the earlier Gitea rows. Fifty identical chips under one heading
  were noise, and the heading already names the source. Search hits and the
  recent list still label each row.
- **The connect form closes on a session change** rather than staying open
  for the next person. The form holds the previous person's token, and its
  pending reply is ignored, so keeping it would strand a busy dialog.
- **No new `github-first-onboarding` case.** Onboarding offers GitHub only.
  The Gitea-namesake rule there is covered by `cloneJobs`, and the unchanged
  spec passed in the whole suite.
- **Captures live in `capture.mjs` against the local synthetic lab**, not in
  an opt-in Playwright case. The routed runner neither forwards
  `OH_VISUAL_CAPTURE` nor returns `test-results`, and TESTING.md names the lab
  snapshot as the evidence route. Dark captures are limited to the form error
  and the common search to keep the evidence small (each HTML twin carries the
  full stylesheet).
- **No new source filter**, as specified.
