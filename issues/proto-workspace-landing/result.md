# Result: workspace landing, prototype round 1

Entry file: [prototypes/tyotilan-etusivu/index.html](prototypes/tyotilan-etusivu/index.html)
(one offline file, 170 KiB, tokens and fonts inlined). Jari's guide in Finnish:
[NOTES.md](NOTES.md).

## Axis

**How the workspace page's landing relates to the conversation start page.**
Content is identical in every direction: the synthetic `aurinkokello`
workspace, one authored start page (title, two-paragraph body, four goals with
what/when/steps/prompt, one with `skill: korjaa`), four open conversations (one
with a new reply, two worktree workers, one idle), three done, and Git
`main · 2 muutosta ↑1` with two files and three commits.

| # | Direction | What it decides | Cost |
| --- | --- | --- | --- |
| 1 | **Nyt** (production context) | The current `WorkspacePage`: head, Git chip, open cards, Valmiit. **+** opens the current conversation start page (`StartHere` catalogue → `GoalGuide` → Aloita), which every direction reuses for comparison. | Repository intro and goals are invisible until a conversation is started. |
| 2 | **Esittely** (recommended) | The same authored start page is *shown* on the workspace page: title, first body paragraph (rest behind *Näytä koko esittely*), the same goal cards. A goal opens a new conversation at its guide; the rest of the page is unchanged. | Goals appear in two places (identical cards, one source). Pushes conversations down by about 380 px at 1440 px. |
| 3 | **Tilannekuva** | The landing *complements* the start page with the live situation: one-sentence description under the name, goals as one pill row, then *Sinun vuorosi* + *Workerit* and an inline Git panel (files, recent commits), then other recent conversations. | Repeats card facts in another shape; the authored intro is reduced to one sentence; most host reads already exist but the worker panel only knows worktree conversations (see host facts). |
| 4 | **Aloitus tässä** | The workspace page *is* the start page: intro and goal cards in a card with its own composer; the guide opens in place, Aloita fills that composer, sending starts the conversation. No **+**. Conversations become a compact list. | Two start pages with identical behavior to maintain; the composer competes with the conversation list; conversation creation moves to first send. |

All directions keep production geometry (296 px rail, 860 px page, 780 px
conversation column, tokens, mono workspace title, icon row, card styles). The
StartHere/GoalGuide rendering and `goalDraft` semantics (skill invocation,
request, existing draft, the single `[placeholder]` last and selected) are
copied from production. Phone layout is the production `max-width: 700px`
behaviour expressed as a container query so the in-page 390 px frame and a real
390 px viewport render the same.

Absent start page (`start_page: null`, toggle *Aloitussivu: Puuttuu*):
Esittely shows one dashed line plus **Luo aloitussivu**, which opens a new
conversation with `/open-habitat-start-page ` in the field; Tilannekuva drops
the description and goal row and shows the same line; Aloitus tässä keeps its
composer with a one-line hint. `needs_update` would use the same slot with
production's *Aloitussivu tarvitsee päivityksen* text; it is not separately
prototyped.

## Host facts each direction needs

| Fact | Exists? | Where it comes from |
| --- | --- | --- |
| Repository description | **Only as the authored start page body.** No README, GitHub/Gitea/GitLab description or other per-workspace description is read. | `GET /api/v1/workspaces/start_page?workspace_id=` in `internal/daemon/start_page_linux.go` (`WorkspaceStartPage`, file-only, no Pi), contract `contracts/v1/composer.schema.json` (`startPage`), client `readStartPage` in `web/src/app/composerReads.ts`. A forge description exists only in clone choosers (`Repo.description` in `web/src/app/github.ts`), not on `Workspace` (`web/src/app/snapshot.ts`). |
| Start goals (title, when, what, steps, prompt, skill) | Yes, same read as above. | Same endpoint; parsed from `.agents/start-page.md` frontmatter. Skill effectiveness is resolved only on Aloita through `readCommands({ workspaceId })` → `GET /api/v1/workspaces/commands` (list-only Pi), as `StartPageRead.tsx` does today. |
| Open conversations, attention, activity | Yes. | `WorkspacePage` props `conversations` (`HomeConversation`, `web/src/components/HomeWorkspaces.tsx`) decorated from `useConversationMetadata` (`web/src/app/conversationStore.ts`); ranking `homeSections`. |
| Recap and "how long ago" | Yes, per conversation. | `readRecap` → `GET /api/v1/agents/<id>/recap` (`web/src/app/conversations.ts`), `latest_message_at`; `HomeCard` already reads it per card. There is no workspace-level last-activity field, so "recent" order beyond `homeSections` would need those per-card reads first. |
| Workers | **Partly.** Worktree agents and worktrees exist at workspace level; Taskfleet runs exist only per parent conversation. | `ReturnConversation.worktree` (`web/src/components/ReturnView.tsx`), `Workspace.worktrees` (`WorktreePlace`, `web/src/app/snapshot.ts`). Taskfleet runs: `GET /api/v1/agents/<parent>/spinoffs` (`web/src/app/spinoffs.ts`). Tilannekuva's *Workerit* panel is therefore "conversations in their own worktree", not every Taskfleet run; a workspace-wide run list would be a new read and is not proposed. |
| Git summary | Yes. | `Workspace.git_summary`; `useGitStatus(workspace, csrf, { eager: true })` in `web/src/app/ConversationGitStatus.tsx` via `GET /api/v1/workspaces/git` (`web/src/app/workspaceGit.ts`). |
| Git files and recent commits inline (Tilannekuva) | Yes. | Same eager read returns `GitDetailFacts` (`files`, `commits`, `unpushed_commits`, `web/src/components/GitStatus.tsx`). `WorkspacePage` already loads it eagerly; Tilannekuva only renders it without the layer. |
| Create conversation on first send (Aloitus tässä) | **Partly.** | Today **+** creates the conversation immediately (`CreatingConversation` in `web/src/app/PendingConversation.tsx`; messages typed meanwhile queue). Only worktree agents are created by the first message (`worktree.onFirstMessage`). A page-level composer needs "create, then post the held message", composed from existing mutations; no new authority. |

No direction needs a new store, cache, registry or contract field. Nothing
crosses the gateway/daemon/provision split: every read is the person's own
daemon reading the person's own files.

## Recommendation

**Esittely.** It answers what Jari asked for ("samanlainen oma landing-osio
kuin agentin etusivulla") with one authored source and existing reads, and it
leaves the conversation start page as the single place where goals are acted
on. Tilannekuva is the better page for a busy multi-worker repository, but its
value is mostly a re-layout of facts the cards already show. If Jari wants it,
I would add its Git panel under Esittely rather than replace the intro.
Aloitus tässä is coherent but doubles the start page and changes when
conversations are created.

## Decisions for later review

1. **Same `.agents/start-page.md`, no separate landing file.** Alternatives: a
   `workspace:` section in the same frontmatter, or a separate
   `.agents/workspace-page.md`. Chose the same file: one place to author, and
   the intro is the repository description in every direction. A separate file
   would be a second truth to keep in sync.
2. **Description = start page body, not README or forge description.**
   Alternatives: README's first paragraph, or the GitHub/Gitea/GitLab
   description. Both would be new reads, README prose is often not written for
   this, and forge descriptions are absent for local repos.
3. **Intro shows the first paragraph; the rest is behind a button.** Safety
   instructions belong in the first paragraph for that reason; this is the
   authoring guidance the start-page skill would carry.
4. **A goal on the workspace page opens a new conversation at its guide
   (Esittely, Tilannekuva).** The prototype switches to the conversation start
   view at once. In production, **+** creates a Pi conversation immediately, so
   the implementation should create it only on **Aloita** (guide read on the
   workspace route), not on merely opening a guide, or browsing would leave
   empty conversations. Alternative: open the guide inline on the workspace
   page, as Aloitus tässä does.
5. **The workspace-page Workerit list means worktree conversations.**
   Alternative: aggregate every conversation's Taskfleet runs (N spinoff reads
   or a new workspace-wide read). Not proposed without a concrete need.
6. **Absent start page offers *Luo aloitussivu*,** preparing
   `/open-habitat-start-page` in a new conversation. Alternative: a hint text
   only, as the conversation start page has.
7. **Aloitus tässä hides +.** Its composer is the new-conversation entry; the
   worktree button stays.

## Verification

```sh
python3 issues/proto-workspace-landing/prototypes/tyotilan-etusivu/build.py
PLAYWRIGHT_DIR=<dir with node_modules/playwright> \
PLAYWRIGHT_BROWSERS_PATH="$HOME/.cache/ms-playwright" \
  node issues/proto-workspace-landing/prototypes/tyotilan-etusivu/check.mjs <out-dir>
```

Ran on Birch with the Playwright already installed under
`~/src/open-habitat/web` and cached Chromium, scratch in
`/var/tmp/oh-proto-workspace-landing.*`. **218/218 checks passed**
([evidence/checks.json](evidence/checks.json)): four directions × light/dark ×
1440/390 px; no horizontal overflow before or after sending; Git layer opens
and closes; intro disclosure; goal → guide in the right place; Aloita prepares
`/skill:korjaa …` ending in the selected `[kuvaile havainto]` with the field
focused; sending shows the bubble; absent start page explains itself, shows no
goals and prepares `/open-habitat-start-page`; picker `?v=` persistence and
number keys; theme and 390 px frame controls; zero console or page errors.

Captures in [evidence/](evidence/) are AVIF at device scale factor 2,
converted with `scripts/screenshots-to-avif.py`; phone captures use a
390 × 1400 viewport so more of the page is visible. Visually reviewed:
Esittely, Tilannekuva and Aloitus tässä at 1440/light, Tilannekuva at 390/dark,
the guide in a new conversation, and the current production workspace page
(`issues/archive-notice-header-row/evidence/*-tyotilasivu.png`) as the
baseline. This is an authored presentation copy, not mounted production React,
not a lab capture and not integration evidence. No production code changed,
so no browser suite or Go checks were run.
