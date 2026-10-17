# Result

Uusi työtila is now a page, as in the prototype direction **Kloonaussivulla**
(round `design-system/prototypes/rounds/2026-10-17-repon-valinta/`). The modal
clone dialog (`NewWorkspace.tsx`) and its styles are gone.

## What changed

- **Route and page.** `/workspaces/new` renders `web/src/app/NewWorkspacePage.tsx`;
  the home page's and the sidebar's Uusi työtila navigate there. The selected
  repository is in the route (`?repo=owner/name`), so a phone's back button
  returns from the details to the list; `?source=directory` selects Uusi
  hakemisto, which creates and opens the workspace with its first conversation
  as before.
- **Kloonaukset at the top.** The newest job per repository (running, failed,
  finished) and every interrupted clone, as cards
  (`web/src/components/ClonePage.tsx`, `CloneCard`): progress bar and stage
  line, Keskeytä with inline confirmation, Yritä uudelleen / Poista ilmoitus,
  Valmis with Avaa työtila, and for an interrupted clone Aloita alusta (full or,
  for a large repo, Kevyt klooni) and Poista keskeneräinen (N MiB). Nothing
  restarts by itself.
- **Store.** `web/src/app/cloneJobs.ts` is a view of the daemon's job list per
  identity: read on sign-in and on the page, followed over the events stream
  while a job runs (resubscribing when a stream ends without a result), read
  again after every write. A read that began before a confirmed write is
  discarded, and a read requested during a read is answered by one more read.
  A confirmed job refreshes the snapshot so the workspace appears.
- **Sidebar block.** Above the workspaces, a link to the page lists running
  (`last 14 %`), failed and interrupted clones (`WorkspaceRail` gained a
  `clones` slot; `Navigation.tsx` change is three lines).
- **Repo list.** Viimeksi päivitetyt (pushes in the last three days, only repos
  that are not workspaces yet, at most four), the person's own repos (Omat),
  each organisation, then other owners (Yhteistyö); five per section plus
  Näytä kaikki N; Kaikki / 30 pv / 3 kk / Vuosi says how many it hides; search
  by name or description. An exact `owner/repo` (also a github.com URL) that
  the catalog lacks is looked up on GitHub and offered, or the page says it
  does not exist or is not accessible. The arrangement is the pure
  `web/src/components/repoCatalog.ts`.
- **Details before cloning.** Visibility, default branch, last push, GitHub's
  size estimate, target `~/src/<name>`, free quota (existing
  `/api/v1/account/storage`). From 500 MiB a warning and the choice Koko
  historia (default) / Kevyt klooni. A repo already present as a workspace
  offers Avaa työtila; a different directory of the same name blocks the clone
  and says so.
- **Jari's prototype observations.** The details pane is sticky with a
  max-height of the window less main's padding and scrolls on its own; the
  search field has focus room above it; any public `owner/repo` is reachable
  through the lookup.
- **Smallest host change.** The catalog reply gained an optional `login` (the
  bound account's own login, read by the same `/user` binding check the
  daemon already made), so "Omat" can be labelled; the snapshot never carried
  the login. Daemon `github_repos_linux.go`, gateway projection
  `github_repos_linux.go` (validated as an owner name, otherwise the reply is
  refused), schema, example, regenerated packages, `docs/architecture/http-api.md`
  and `workspaces.md`.
- **Test host.** `/fixture/clone?mode=hold|release|fail-once|normal` steers
  the synthetic `git clone` so the browser specs can leave during a clone and
  see an early-EOF failure.

## Evidence

- `./scripts/test-focused.sh --area web`: pass (static, unit, component),
  including new `cloneJobs.test.ts` (a read during a write is followed by
  another; a stale read cannot undo a dismissal when the next read fails; a
  followed job reports its confirmation once), `NewWorkspacePage.test.tsx`
  (an aborted lookup is retried) and `repoCatalog.test.ts`. The two
  review-fix tests were checked to fail with the old code.
- `--area contracts`: pass. `--area go` for `./internal/daemon` and
  `./internal/gateway`: pass (catalog tests assert the login and the refusal
  of a malformed one). `./scripts/test-repo-catalog-uids.sh` (three kernel
  UIDs): pass.
- Browser (lab, host-backed synthetic): `clone-page.spec.ts` — success and
  open (with axe, no serious/critical violations), leave during a clone and
  return through the rail including a reload, failure then retry, cancel only
  after confirmation (directory absent afterwards), interrupted clones removed
  and restarted only explicitly, phone list/details one at a time, sticky
  details within the window and the search ring's room. Also
  home-workspace-sections, lab-onboarding, lab-sidebar-account, queued-send,
  workspace-slice, github-first-onboarding, github-denied, github-session,
  github-slow, github-observation, onboarding-notices, shell-accessibility.
- Limits: no live GitHub, no real multi-gigabyte clone, no real daemon restart
  under systemd (the interrupted state comes from the fixture's leftover
  directory). The lab runs every identity under one Unix user.

## Prototype comparison

Screenshots in `shots/`: `lab-*` from the lab (`OH_VISUAL_CAPTURE=1`, test
"clone page states for the prototype comparison"), `proto-*` from the built
prototype (`shots/capture-prototype.mjs`). States: **jobs** (one running
clone, one interrupted) and **details** (a large private repo with Kevyt
klooni), desktop 1280 and phone 390, light and dark, plus the lab's phone
sidebar. The prototype's phone frame clips its stage so the script could not
frame the phone jobs state; that pair is missing and the phone jobs view was
checked against the prototype's desktop cards, which use the same markup.

Differences and why:

1. **Time filter** is a `Segmented` control, not separate pills: the button
   system makes every one-of-several choice a segment (Rooli ratkaisee).
2. **Secondary buttons** are tinted surfaces rather than outlined, and sizes
   follow roles (Kloonaa työtilaksi `page`, card actions `row`, Näytä kaikki
   `inline`) — the button system.
3. **Interrupted card** says "Kloonaus keskeytyi … esimerkiksi koska palvelin
   käynnistyi uudelleen" without the time and received bytes: after a restart
   the daemon knows only the directory and its size, not when or why.
4. **No "Yhteys katkesi, yhdistetään…" phase** in the card: the store
   resubscribes silently and the app's own connection banner shows an outage.
5. **Running card does not promise to open the workspace**: the page never
   navigates by itself; Valmis offers Avaa työtila.
6. **One clone at a time**: Kloonaa työtilaksi is disabled with the reason
   while another clone runs (daemon rule from ADR 0024); the prototype ran
   several.
7. **Valmis card** has no disk size or branch line: the job does not report
   them.
8. **Details pane** stays within the window and scrolls on its own, and the
   search field has focus room — Jari's observations, deliberately unlike the
   prototype.
9. **Viimeksi päivitetyt** is absent in the lab shots because no fixture repo
   was pushed in the last three days; the rule is unit-tested.
10. **Phone back link** "Kaikki repot" is the system's inline link
    (underlined, accent) rather than the prototype's button-like link.
11. **Sidebar block** sits at the top of the scrolling workspace list, below
    the "N työtilaa" summary; the prototype put it right under the section
    head. Content is the same.
12. **Search placeholder** says "Hae nimellä tai kirjoita omistaja/repo" and an
    exact name gets its own "GitHubista" section, for the lookup Jari asked for.

## Review

One independent `/llm-review` of `main..HEAD` (finder GPT-6 Astra, verifier
Claude Fable 5.1, two calls) and `/assess-findings`. Four findings, all
confirmed; three fixed with tests (a stale list read could undo a dismissal;
an aborted repository lookup stayed "searching" forever; a same-named
directory whose origin could not be read was treated as the selected repo and
offered Avaa työtila). The fourth, clone-list reads not bound to the store's
identity when another tab signs in as someone else, was dropped as rare: it
shows only the current cookie holder's own jobs for one read, writes stay
CSRF-bound, and the same class covers every earlier GitHub onboarding read.
Both models missed that the gateway's strict catalog projection would refuse
the new `login` field; the browser specs caught it.

While making the specs reliable, an interrupted clone was observed to drop out
of one list reply when processes of the same user started and exited rapidly
(the daemon's process scan reports them unreadable). Filed as intake
`hugely-dear-talk`; the fixture's hold loop now sleeps a second instead of a
tenth.

## Decisions for later review

- **Route `/workspaces/new`** with the selection in `?repo=` and the source in
  `?source=`. The gateway's login return path does not accept it, so a
  re-login lands on `/workspaces` (left unchanged rather than widening
  `uiReturn`).
- **Catalog carries `login`** (optional) instead of deriving "Omat" from owner
  counts or adding it to the snapshot. Without it every User section would
  read "Yhteistyö".
- **Avaa työtila on a fresh clone starts its first conversation**, as Luo
  työtila does (Jari 16.10.2026); a workspace that already has conversations
  just opens. Opening dismisses the finished job.
- **The page shows the newest job per repository**; an older failed job of the
  same repo is dismissed when its retry starts. Cancelled jobs that left
  nothing are not shown.
- **Exact-origin match** decides "työtilana": a same-named directory without a
  readable GitHub origin is treated as taken (clone blocked), never as this
  repository.
- **Kevyt klooni** is offered only from 500 MiB (GitHub's estimate), as in the
  prototype; smaller repos clone with full history.
- **No Storybook stories** were added for the new components; the browser
  specs and lab screenshots carry their states.
