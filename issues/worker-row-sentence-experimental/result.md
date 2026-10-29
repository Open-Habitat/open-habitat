# Result

Lause from `proto-worker-row-work-facts` is in the product behind the
experimental switch *Workerin työ rivillä* (`worker-row-sentence`). While the
switch is off, nothing of it is shown and the browser asks the host nothing new.

What the person sees when it is on:

- **Workerit panel:** on a worker row, the second line continues after the
  state word with what the worker has produced: *2 committia · 3 muutosta*,
  *ei vielä muutoksia* or *työn tila ei tiedossa*. When there is a PR it
  follows, with its checks in one coloured word (*PR #412 luonnos
  tarkistukset käynnissä*). A landed worker's row has no facts.
- **gh note:** when gh could not answer for a worker that Git did answer for,
  the panel carries one note. If the snapshot says gh is not logged in, the
  note links to Koodipalvelut › GitHub.
- **Worker view:** the band has a full-width line with the whole sentence
  (commits, uncommitted files, lines added and removed, how far the source
  branch has moved, the PR and its checks) and *Avaa PR #n*, which opens
  GitHub.
- **Rail:** a worktree conversation has a short second line (*1 commit*,
  *ei vielä muutoksia*) built from the place's `git_summary`, which the
  snapshot already carries.

Evidence (`evidence/`, device scale factor 2): the panel on desktop light and
dark and on a phone, the worker view on desktop and phone, and the rail on the
lab host with native Git.

## Host

- **Route:** `GET /api/v1/agents/pi:<session>/spinoff-work`
  (`internal/daemon/spinoff_work_linux.go`), contract
  `contracts/v1/spinoff-work.schema.json`. The gateway allowlists the exact
  path, which takes no query.
- **Which runs:** the same rows the panel lists: the parent's runs, at most 20,
  excluding landed runs and ended runs with nothing left on disk.
- **Git:** for each run the daemon reads Git as the person.
  - In the worker's worktree it reads status, ahead/behind against the run's
    `source_branch`, and lines from the merge base to the working tree,
    untracked files included.
  - When the worktree is gone it reads the kept branch in the source
    repository.
- **PR:** the daemon runs `gh pr list --head=<branch> --state=all --limit=1`
  through `nativegh.Executor` (the person's own login, fixed environment), at
  most four at a time, within an 8 s budget.
- **Unknown stays unknown:**
  - `git: unavailable` is not "nothing yet".
  - `pull_request_state` is `unknown` unless gh answered. It is `unsupported`
    only when the repository has no origin or an origin that is not
    github.com.
  - The line totals are absent when status was truncated or a file could not
    be counted.
- **Index:** the working-tree diff runs with `diff.autoRefreshIndex=false` so
  it never takes the worker's `index.lock`. The same one-line fix went into
  the existing on-demand compare (`addGitLineCounts`).

## Browser

- `useWorkerWork` in `SpinoffConversation.tsx` reads the route only while the
  switch is on. It reads again at once when the listed runs or their states
  change, and otherwise every 30 s. Facts that could not be read are dropped,
  not kept as stale.
- The wording is in `web/src/app/workSentence.ts`.
- `App` reads the switch above `AccountPreferencesProvider`, so
  `useExperimentalFeature` now accepts a named session.
- The feature's card is `landed: true`. Its *Missä* line now names the worker
  view and says the rail has no PR.

## Tests

- **Daemon:**
  - `TestSpinoffWorkReadsEachWorkerAgainstItsSourceBranch`: real Git
    worktrees plus a fake Taskfleet. Covers busy, fresh, not-yet-created,
    kept-branch and landed workers, the PR states, and no query accepted.
  - `TestWorkerGitLeavesWhatItCannotCountUnknown`: no origin; an ssh GitHub
    address; a binary file; a file too large to count.
  - `TestParsePullRequestCountsChecksAndRefusesWhatItCannotRead`.
- **Gateway:** the path allowlist.
- **Contracts:** example plus negative cases. A PR is present exactly when
  found, and its link must point at github.com.
- **Vitest:** `workSentence.test.ts`.
- **Browser:**
  - `web/tests/worker-row-sentence.spec.ts` (host-backed, routes served):
    off means no read and nothing shown; on gives the rows, the note, no
    facts for a landed run, no sideways scroll on a phone, the worker view's
    PR link, and axe.
  - `web/tests/lab-worker-row-sentence.spec.ts` (lab, native Git): the rail
    line appears only after the switch.

## Review

Independent `/llm-review`: gpt-6-astra as finder and claude-fable-5-1 as
verifier on the route's boundary. Then `/assess-findings`: 4 confirmed, all
fixed in this change.

1. Line totals could be too small when status was truncated or a file could
   not be counted.
2. A failed origin read was reported as "not GitHub".
3. The working-tree diff could rewrite the worker's index and take
   `index.lock`. I reproduced this locally.
4. Tracked and untracked binary files were counted differently.

The verifier found that the access boundary holds: the browser selects nothing
but the session, and no native text, token or remote URL is returned.

## Decisions for later review

- **A separate route, not a field on the spinoffs read.**
  - Alternative: add `git_summary` and the PR to each run in `/spinoffs`.
  - Why: the spinoffs read runs every 3 s, and gh takes about a second per
    branch. Keeping it apart is also how "off fetches nothing" holds without
    the daemon reading the preference.
- **PR facts are read every 30 s and whenever the listed runs change.**
  - Alternative: the spinoffs pace, or only on opening the panel.
  - Why: one GitHub request per worker branch per read. At 20 workers that is
    about 2,400 requests an hour per open conversation, under GitHub's 5,000.
    It runs only while the switch is on and a conversation with workers is
    open.
- **The rail shows Git facts only, with no PR.**
  - Alternative: one gh request per worktree conversation.
  - Why: the rail is visible on every page, and its rows are one line. The
    card's *Missä* says so.
- **The gh note's cause comes from the snapshot's `native_github` state.**
  - When the snapshot says gh is not logged in (*disconnected* or
    *expired*), the note says so and links to Koodipalvelut.
  - Otherwise it says gh did not answer.
  - The terminal-conversation view (`HistoryView`) has no snapshot at hand, so
    there it always gives the generic note.
- **The worker view shows the sentence, not the Työ card.**
  - Alternative: the recommendation's Työrivi card with files and every check.
  - Why: Jari chose Lause; the card is a separate step if he wants it.
- **Line totals: a binary file counts no lines; a file that cannot be read
  makes the total unknown.**
  - This matches Git's numstat, and a smaller-than-true total is never shown.
- **Closed PR state.** A PR closed without merging reads *suljettu* and shows
  no check word. The prototype had no such case.
- **`gh pr list --head` matches by branch name only.** In a repository with
  forks, a fork's PR from a branch of the same name could be shown. Worker
  branch names (`wt/…`) make this unlikely.
- **`ssh://git@github.com/…` origins are not parsed** (shared
  `githubRepoName`). Their PR state is *unknown* and the panel note says gh
  did not answer. `git@github.com:` and `https://github.com/` origins work.
