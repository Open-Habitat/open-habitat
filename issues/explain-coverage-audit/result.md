# Result: Explain-mode coverage audit

## What was wrong

The workspace front page looked almost unexplained because its most visible
parts had no card: the icon and its source line, the whole icon-suggestion
panel (suggestions, wish field and its send, quick wishes, Ei nyt), the folder
path, the Valmiit and Arkisto folds and the rename and delete dialogs. The
hit map in `evidence/` shows it: red where pointing explained nothing
(`hitmap-before-*`) and the same page now (`hitmap-after-*`).

Elsewhere: the new-workspace page had no cards at all; settings pages had a
card only on their navigation entry, so pointing at the page itself explained
nothing; the rail's workspace icon card, Nosta/Laske/Ei nyt, the phone's
Keskustelun tiedot menu and ⋯ editor/terminal rows, the context breakdown
page, the background panel's Käsittele/Kerro agentille and Päättyneet, the
server Keskustelut page, the settings back links and a few closes had none.
The Git panel's section cards (P02–P08) were found by position and missed the
workspace page's Git dialog; they now use a `data-section` attribute.

Found on the way and fixed: on a phone, starting the mode from the drawer's
account menu put the mode's bar over the drawer's head, hiding its × (the
close sat at y 6 under a 40 px bar). The drawer now starts below the bar.

## How it was inventoried

`web/tests/lab-explain-coverage.spec.ts` walks the views at 1440 and 390 in
the synthetic lab (home and drawer, account menu, new workspace with a chosen
repository and the directory form, workspace front page with its icon picker,
Git dialog, folds, rename and delete dialogs, rail icon card and a hovered
rail row, a new and an answered conversation with every header panel, the
background panels, assets, browser, terminal, editor, the context page, the
phone ⋯ and facts menus, a worker and a helper view, and every settings
section). For every visible control it records the card the mode would show
(its own, or the nearest region's). With `OH_EXPLAIN_INVENTORY=<dir>` it
writes that inventory, plus passive parts with a test id or role, as JSON
instead of asserting. The table below joins a run against the code before
this work and one after. `web/lab/explain-coverage-audit.mjs` takes the
screenshots and paints the hit maps.

Views with no Explain mode by construction, so no cards: the sign-in and
landing pages (the mode is an account preference, unknown before sign-in) and
the standalone `/view`, `/offer` and link pages, which `main.tsx` renders
outside the app that mounts the mode. Not walked: first-login onboarding,
clone-in-progress cards (their cancel/retry/remove cards were mapped from the
code, not seen live), connection-error banners and the worktree section of a
workspace page (the lab's workspace shows none; see below).

## Inventory

"Region card" means the control has no card of its own and the enclosing
part's card explains it (a settings page's rows, a dialog's buttons). Rows
that appear in every signed-in view (the rail, the account menu) are listed
once. "Before" is main before this round, so "New card" also counts the
cards the parallel worktree, composer-stack and compaction issues brought
(T15–T23, V28, K22, K26–K29).

### Controls

| Element | Where (widths) | Before | Now | Decision |
| --- | --- | --- | --- | --- |
| `close-editor` | Conversation (1440) | D05 | D05 | Card |
| `close-terminal` | Conversation (1440) | R03 | R03 | Card |
| `context-back` | Conversation (1440) | — | P17 | **New card** |
| `context-ring` | Conversation (1440) | Y05 | Y05 | Card |
| `conversation-details › button.ah-button-text` | Conversation (1440) | P10 | P10 | Region card |
| `conversation-details › button.ah-button` | Conversation (1440) | P10 | P10 | Region card |
| `conversation-model` | Conversation (1440) | Y06 | Y06 | Card |
| `conversation-recheck` | Conversation (1440) | K19 | K19 | Card |
| `editor-file-entry` | Conversation (1440) | D06 | D06 | Region card |
| `editor-file-filter` | Conversation (1440) | D07 | D07 | Card |
| `editor-file-picker › button.ah-button-text` | Conversation (1440) | D06 | D06 | Region card |
| `editor-picker` | Conversation (1440) | D02 | D02 | Card |
| `editor-save` | Conversation (1440) | D03 | D03 | Card |
| `hide-conversation` | Conversation (1440) | D04 | D04 | Card |
| `hide-terminal` | Conversation (1440) | R06 | R06 | Card |
| `maximize-terminal` | Conversation (1440) | R05 | R05 | Card |
| `new-terminal` | Conversation (1440) | R04 | R04 | Card |
| `rail-all-workspaces` | Conversation (1440) | S20 | S20 | Card |
| `terminal-panel › button` | Conversation (1440) | R02 | R02 | Card |
| `conversation-workspace` | Conversation (1440); Helper view (1440); New conversation (1440); Worker view (1440) | Y02 | Y02 | Card |
| `workspace-details` | Conversation (1440); Helper view (1440); New conversation (1440); Worker view (1440) | Y13 | Y13 | Card |
| `archive-conversation` | Conversation (1440); Home and navigation (1440/390); Workspace front page (1440/390) | Y11 | Y11 | Card |
| `conversation-recap` | Conversation (1440); New conversation (1440) | Y09 | Y09 | Card |
| `conversation-retitle` | Conversation (1440); New conversation (1440) | Y10 | Y10 | Card |
| `git-chip` | Conversation (1440); New conversation (1440) | Y04 | Y04 | Card |
| `toggle-editor` | Conversation (1440); New conversation (1440) | Y07 | Y07 | Card |
| `toggle-terminal` | Conversation (1440); New conversation (1440) | Y08 | Y08 | Card |
| `dialog-close` | Conversation (1440); New conversation (1440); Workspace front page (1440/390) | P01, Y12 | P16, Y12 | Card widened or changed |
| `fetch-git` | Conversation (1440); Workspace front page (1440/390) | P09 | P09 | Card |
| `git-commits-in › summary` | Conversation (1440); Workspace front page (1440/390) | P04, P07 | P04, P07 | Card |
| `git-commits-out › summary` | Conversation (1440); Workspace front page (1440/390) | P03, P06 | P03, P06 | Card |
| `ask-agent` | Conversation (1440/390) | V12 | V31 | Card widened or changed |
| `ask-all-pill` | Conversation (1440/390) | V09 | V29 | Card widened or changed |
| `asset-open` | Conversation (1440/390) | V17 | V17 | Card |
| `assets-chip` | Conversation (1440/390) | V13 | V13 | Card |
| `assets-close` | Conversation (1440/390) | V26 | V26 | Card |
| `background-helpers` | Conversation (1440/390) | V15 | V15 | Card |
| `background-spinoffs` | Conversation (1440/390) | V11 | V11 | Card |
| `background-tab-process` | Conversation (1440/390) | P14 | P14 | Card |
| `background-tab-spinoff` | Conversation (1440/390) | P14 | P14 | Card |
| `browser-look` | Conversation (1440/390) | B03 | B03 | Card |
| `browser-window › button` | Conversation (1440/390) | B03 | B03 | Card |
| `close` | Conversation (1440/390) | V09 | P16 | Card widened or changed |
| `ended-runs` | Conversation (1440/390) | V09 | V30 | Card widened or changed |
| `helper-layout-review` | Conversation (1440/390) | V16 | V16 | Card |
| `history-stage-toggle` | Conversation (1440/390) | K04 | K04 | Card |
| `mermaid-diagram › summary` | Conversation (1440/390) | K14 | K14 | Card |
| `message › a.ah-file-link` | Conversation (1440/390) | K12 | K12 | Card |
| `message-copy` | Conversation (1440/390) | K02 | K02 | Card |
| `output-copy` | Conversation (1440/390) | K15 | K15 | Card |
| `spinoff-Kastelun ajastus` | Conversation (1440/390) | P15 | P15 | Card |
| `spinoff-Kasvilajien tuonti` | Conversation (1440/390) | P15 | P15 | Card |
| `header-activity` | Conversation (1440/390); Helper view (1440/390); New conversation (1440/390); Worker view (1440/390) | Y03 | Y03 | Card |
| `conversation-menu` | Conversation (1440/390); Helper view (390); New conversation (390); Worker view (390) | Y14 | Y14 | Card |
| `button` | Conversation (1440/390); Home and navigation (1440/390); Workspace front page (1440/390) | — | — | None on purpose: A screen reader's dismiss button for an open menu or popover, visually hidden. |
| `background-processes` | Conversation (1440/390); New conversation (1440/390) | V10 | V10 | Card |
| `browser-chip` | Conversation (1440/390); New conversation (1440/390) | B01 | B01 | Card |
| `command-palette` | Conversation (1440/390); New conversation (1440/390) | V03 | V03 | Card |
| `conversation-rename` | Conversation (1440/390); New conversation (1440/390) | Y01 | Y01 | Card |
| `file-picker` | Conversation (1440/390); New conversation (1440/390) | V04 | V04 | Card |
| `message-input` | Conversation (1440/390); New conversation (1440/390) | V01 | V01 | Card |
| `attach-file` | Conversation (1440/390); New conversation (1440/390); Workspace front page (1440/390) | V02 | V02 | Card |
| `dictation-mic` | Conversation (1440/390); New conversation (1440/390); Workspace front page (1440/390) | V05 | V05 | Card |
| `send` | Conversation (1440/390); New conversation (1440/390); Workspace front page (1440/390) | V06 | T31, V06 | Card widened or changed |
| `menu-archive` | Conversation (390) | Y11 | Y11 | Card |
| `menu-close` | Conversation (390) | — | P16 | **New card** |
| `menu-details` | Conversation (390) | Y13 | Y13 | Card |
| `menu-fact-context` | Conversation (390) | — | Y05 | **New card** |
| `menu-fact-git` | Conversation (390) | — | Y04 | **New card** |
| `menu-fact-model` | Conversation (390) | — | Y06 | **New card** |
| `menu-fact-workspace` | Conversation (390) | — | Y02 | **New card** |
| `menu-recap` | Conversation (390) | Y09 | Y09 | Card |
| `menu-rename` | Conversation (390) | Y01 | Y01 | Card |
| `menu-retitle` | Conversation (390) | Y10 | Y10 | Card |
| `menu-toggle-editor` | Conversation (390) | — | Y07 | **New card** |
| `menu-toggle-terminal` | Conversation (390) | — | Y08 | **New card** |
| `menu-workspace` | Conversation (390) | Y02 | Y02 | Card |
| `offer-download` | Conversation (390) | V25 | V25 | Card |
| `offer-open-tab` | Conversation (390) | V24 | V24 | Card |
| `output-wrap` | Conversation (390) | K16 | K16 | Card |
| `phone-header-facts` | Conversation (390); Helper view (390); New conversation (390); Worker view (390) | — | Y17 | **New card** |
| `menu-explain` | Conversation (390); Home and navigation (1440/390) | X03 | X03 | Card |
| `composer-model-picker` | Conversation (390); New conversation (1440/390) | A05 | A05 | Card |
| `starting-goal` | Conversation (390); New conversation (1440/390); Workspace front page (1440/390) | A02, T11 | A02, T11 | Card |
| `account-menu-trigger` | Every signed-in view | S21 | S21 | Card |
| `agent-link` | Every signed-in view | S09 | S09 | Card |
| `browser-rail-row` | Every signed-in view | B07 | B07 | Card |
| `close-navigation` | Every signed-in view | S04 | S04 | Card |
| `home-link` | Every signed-in view | S03 | S03 | Card |
| `navigation-open` | Every signed-in view | Y16 | Y16 | Card |
| `rail-quiet-fold` | Every signed-in view | S07 | S07 | Card |
| `rail-quiet-menu` | Every signed-in view | S08 | S08 | Card |
| `segment-*` | Every signed-in view | L06, L09, S24, S25 | L06, L09, M06, M07, M13, M15, M19, M21, M22, N01, N03, S24, S25 | Card widened or changed |
| `server-home` | Every signed-in view | S01 | S01 | Card |
| `settings-aiavain` | Every signed-in view | M19 | M19 | Card |
| `settings-avaimet` | Every signed-in view | M05 | M05 | Card |
| `settings-close` | Every signed-in view | M02 | M02 | Card |
| `settings-editori` | Every signed-in view | M13 | M13 | Card |
| `settings-kayttajat` | Every signed-in view | M22 | M22 | Card |
| `settings-kayttoonotto` | Every signed-in view | M21 | M21 | Card |
| `settings-keskustelut` | Every signed-in view | — | M26 | **New card** |
| `settings-kokeelliset` | Every signed-in view | M15 | M15 | Card |
| `settings-koodipalvelut` | Every signed-in view | M09 | M09 | Card |
| `settings-laitteet` | Every signed-in view | M04 | M04 | Card |
| `settings-levy` | Every signed-in view | M23 | M23 | Card |
| `settings-list-back` | Every signed-in view | — | M27 | **New card** |
| `settings-omatkoneet` | Every signed-in view | M11 | M11 | Card |
| `settings-own-back` | Every signed-in view | — | M28 | **New card** |
| `settings-palvelin` | Every signed-in view | M17 | M17 | Card |
| `settings-palvelinintegraatiot` | Every signed-in view | M18 | M18 | Card |
| `settings-sanelu` | Every signed-in view | M08 | M08 | Card |
| `settings-saneluavain` | Every signed-in view | M20 | M20 | Card |
| `settings-search` | Every signed-in view | M01 | M01 | Card |
| `settings-tekoaly` | Every signed-in view | M06 | M06 | Card |
| `settings-tiedot` | Every signed-in view | M10 | M10 | Card |
| `settings-tila` | Every signed-in view | M14 | M14 | Card |
| `settings-tilannekatsaus` | Every signed-in view | M07 | M07 | Card |
| `settings-tili` | Every signed-in view | M03 | M03 | Card |
| `settings-ulkoasu` | Every signed-in view | M12 | M12 | Card |
| `skip-content` | Every signed-in view | — | — | None on purpose: The skip link appears only under keyboard focus; the mode is pointed or tapped. |
| `snapshot-refresh` | Every signed-in view | S17 | S17 | Card |
| `workspace-<name>` | Every signed-in view | E02, E07, S18 | E02, E07, S18 | Card |
| `workspace-create` | Every signed-in view | S15 | S15 | Card |
| `workspace-filter` | Every signed-in view | S16 | S16 | Card |
| `workspace-icon-button` | Every signed-in view | S05 | S30 | Card widened or changed |
| `parent-top` | Helper view (1440/390); Worker view (1440/390) | W02 | W02 | Card |
| `worker-ask` | Helper view (1440/390); Worker view (1440/390) | W04 | W04 | Card |
| `menu-administration` | Home and navigation (1440/390) | S23 | S23 | Card |
| `menu-logout` | Home and navigation (1440/390) | S26 | S26 | Card |
| `menu-settings` | Home and navigation (1440/390) | S22 | S22 | Card |
| `workspace-start-aurinkokello` | Home and navigation (1440/390) | S19 | S19 | Card |
| `workspace-start-kotisivu` | Home and navigation (1440/390) | S19 | S19 | Card |
| `workspace-start-muistiinpanot` | Home and navigation (1440/390) | S19 | S19 | Card |
| `workspace-start-reseptikirja` | Home and navigation (1440/390) | S19 | S19 | Card |
| `workspace-start-tilastoharjoitus` | Home and navigation (1440/390) | S19 | S19 | Card |
| `home-conversation-<id>` | Home and navigation (1440/390); Workspace front page (1440/390) | E03 | E03 | Region card |
| `open-conversation` | Home and navigation (1440/390); Workspace front page (1440/390) | E06 | E06 | Card |
| `button.ah-button` | Home and navigation (390) | — | S04 | **New card** |
| `rail-archive-conversation` | Home and navigation (390); Workspace front page (1440) | S13 | S13 | Card |
| `rail-raise-conversation` | Home and navigation (390); Workspace front page (1440) | — | S31 | **New card** |
| `rail-rename-conversation` | Home and navigation (390); Workspace front page (1440) | S12 | S12 | Card |
| `model-commit` | New conversation (1440/390) | L11 | L11 | Card |
| `model-default-settings` | New conversation (1440/390) | L10 | L10 | Card |
| `model-gpt-5.6-terra` | New conversation (1440/390) | L07 | L07 | Card |
| `model-gpt-6-astra` | New conversation (1440/390) | L07 | L07 | Card |
| `model-gpt-6-luna` | New conversation (1440/390) | L07 | L07 | Card |
| `model-gpt-6-nova` | New conversation (1440/390) | L07 | L07 | Card |
| `model-gpt-6.1-sol` | New conversation (1440/390) | L07 | L07 | Card |
| `older-models-toggle` | New conversation (1440/390) | L08 | L08 | Card |
| `settings-claude` | New conversation (1440/390) | — | L12 | **New card** |
| `create-directory` | New workspace (1440/390) | — | N13 | **New card** |
| `directory-name` | New workspace (1440/390) | — | N12 | **New card** |
| `expand-repos` | New workspace (1440/390) | — | N06 | **New card** |
| `repository-clone` | New workspace (1440/390) | — | N09 | **New card** |
| `repository-option-*` | New workspace (1440/390) | — | N04 | **New card** |
| `repository-search` | New workspace (1440/390) | — | N02 | **New card** |
| `all-repos` | New workspace (390) | — | N07 | **Now covered** by its region card |
| `git-identity-edit` | Settings › account (1440/390) | M24 | M24 | Card |
| `logout-open` | Settings › account (1440/390); Settings › devices (1440/390) | S26 | S26 | Card |
| `code-host-new-workspace` | Settings › code-hosts (1440/390) | — | M09 | **New card** |
| `own-machines-add` | Settings › machines (1440/390) | — | M11 | **New card** |
| `speech-key-input` | Settings › speech (1440/390); Settings › speech-key (1440/390) | — | M08, M20 | **Now covered** by its region card |
| `speech-key-more › summary` | Settings › speech (1440/390); Settings › speech-key (1440/390) | — | M08, M20 | **Now covered** by its region card |
| `speech-key-save` | Settings › speech (1440/390); Settings › speech-key (1440/390) | — | M08, M20 | **Now covered** by its region card |
| `cleanup-worktrees` | Settings › storage (1440/390) | — | T23 | **New card** |
| `workspace-card-new` | Workspace front page (1440) | — | T08 | **New card** |
| `workspace-card-open` | Workspace front page (1440) | — | Y02 | **New card** |
| `conversation-start` | Workspace front page (1440/390) | T08 | T08 | Card |
| `copy-path` | Workspace front page (1440/390) | T02 | T02 | Card |
| `delete-workspace` | Workspace front page (1440/390) | T06 | T06 | Card |
| `landing-more` | Workspace front page (1440/390) | T10 | T10 | Card |
| `new-worktree` | Workspace front page (1440/390) | T07 | T07 | Card |
| `open-github` | Workspace front page (1440/390) | T03 | T03 | Card |
| `recheck` | Workspace front page (1440/390) | — | T36 | **Now covered** by its region card |
| `rename-workspace` | Workspace front page (1440/390) | T04 | T04 | Card |
| `save-workspace-name` | Workspace front page (1440/390) | — | T35 | **Now covered** by its region card |
| `summary` | Workspace front page (1440/390) | — | T14, T34 | **New card** |
| `workspace-archive` | Workspace front page (1440/390) | T05 | T05 | Card |
| `workspace-delete-dialog › button.ah-button-text` | Workspace front page (1440/390) | — | T36 | **Now covered** by its region card |
| `workspace-git` | Workspace front page (1440/390) | T12 | T12 | Card |
| `workspace-icon-ask-model` | Workspace front page (1440/390) | — | T27 | **New card** |
| `workspace-icon-auto` | Workspace front page (1440/390) | — | T25 | **New card** |
| `workspace-icon-dialog › button.ah-button` | Workspace front page (1440/390) | — | P16 | **New card** |
| `workspace-icon-emoji` | Workspace front page (1440/390) | — | T25 | **New card** |
| `workspace-icon-letters-input` | Workspace front page (1440/390) | — | T26 | **New card** |
| `workspace-icon-letters` | Workspace front page (1440/390) | — | T25 | **New card** |
| `workspace-icon-own-use` | Workspace front page (1440/390) | — | T25 | **New card** |
| `workspace-icon-own` | Workspace front page (1440/390) | — | T40 | **New card** |
| `workspace-icon-picker` | Workspace front page (1440/390) | — | T24 | **New card** |
| `workspace-icon-quick` | Workspace front page (1440/390) | — | T32 | **New card** |
| `workspace-icon-suggestion` | Workspace front page (1440/390) | — | T29 | **New card** |
| `workspace-icon-suggestions-dismiss` | Workspace front page (1440/390) | — | T33 | **New card** |
| `workspace-icon-wish` | Workspace front page (1440/390) | — | T30 | **New card** |
| `workspace-name` | Workspace front page (1440/390) | — | T35 | **Now covered** by its region card |
| 1 row controls of the page | Settings › agent-data | — | M10 | **Now covered** by the page card; rows describe themselves |
| 4 row controls of the page | Settings › ai | — | M06 | **Now covered** by the page card; rows describe themselves |
| 4 row controls of the page | Settings › ai-key | — | M19 | **Now covered** by the page card; rows describe themselves |
| 1 row controls of the page | Settings › appearance | — | M12 | **Now covered** by the page card; rows describe themselves |
| 6 row controls of the page | Settings › conversations | — | M26 | **Now covered** by the page card; rows describe themselves |
| 1 row controls of the page | Settings › devices | — | M04 | **Now covered** by the page card; rows describe themselves |
| 6 row controls of the page | Settings › disk | — | M23 | **Now covered** by the page card; rows describe themselves |
| 1 row controls of the page | Settings › keys | — | M05 | **Now covered** by the page card; rows describe themselves |
| 6 row controls of the page | Settings › onboarding | — | M21 | **Now covered** by the page card; rows describe themselves |
| 3 row controls of the page | Settings › recap | — | M07 | **Now covered** by the page card; rows describe themselves |
| 2 row controls of the page | Settings › server | — | M17 | **Now covered** by the page card; rows describe themselves |
| 6 row controls of the page | Settings › server-integrations | — | M18 | **Now covered** by the page card; rows describe themselves |
| 1 row controls of the page | Settings › storage | — | M14 | **Now covered** by the page card; rows describe themselves |
| 4 row controls of the page | Settings › users | — | M22 | **Now covered** by the page card; rows describe themselves |

### Passive parts that changed (chips, marks, status lines)

| Element | Where (widths) | Before | Now | Decision |
| --- | --- | --- | --- | --- |
| `context-page › p.ah-cd-text` | Conversation (1440) | — | P18 | **Now covered** by its region card |
| `status-mark` | Every signed-in view | S02 | M06, M09, M11, S02 | Card widened or changed |
| `repo-owner-*` | New workspace (1440/390) | — | N05 | **New card** |
| `git-identity-name` | Settings › account (1440/390) | — | M03 | **Now covered** by its region card |
| `settings-section-tili` | Settings › account (1440/390) | — | M03 | **Now covered** by its region card |
| `settings-section-tiedot` | Settings › agent-data (1440/390) | — | M10 | **Now covered** by its region card |
| `api-key-missing` | Settings › ai (1440/390) | — | M06 | **Now covered** by its region card |
| `claude-login-state` | Settings › ai (1440/390) | — | M06 | **Now covered** by its region card |
| `openai-credential-state` | Settings › ai (1440/390) | — | M06 | **Now covered** by its region card |
| `settings-section-tekoaly` | Settings › ai (1440/390) | — | M06 | **Now covered** by its region card |
| `given-42` | Settings › ai-key (1440/390) | — | M19 | **Now covered** by its region card |
| `given-43` | Settings › ai-key (1440/390) | — | M19 | **Now covered** by its region card |
| `joined-waiting` | Settings › ai-key (1440/390) | — | M19 | **Now covered** by its region card |
| `settings-section-aiavain` | Settings › ai-key (1440/390) | — | M19 | **Now covered** by its region card |
| `settings-section-ulkoasu` | Settings › appearance (1440/390) | — | M12 | **Now covered** by its region card |
| `github-native-state` | Settings › code-hosts (1440/390) | — | M09 | **Now covered** by its region card |
| `settings-section-koodipalvelut` | Settings › code-hosts (1440/390) | — | M09 | **Now covered** by its region card |
| `code-host-workspace` | Settings › code-hosts (390) | — | M09 | **Now covered** by its region card |
| `live-memory › div.ah-meter` | Settings › conversations (1440/390) | — | M26 | **Now covered** by its region card |
| `live-status` | Settings › conversations (1440/390) | — | M26 | **Now covered** by its region card |
| `live-worst` | Settings › conversations (1440/390) | — | M26 | **Now covered** by its region card |
| `settings-section-keskustelut` | Settings › conversations (1440/390) | — | M26 | **Now covered** by its region card |
| `settings-section-laitteet` | Settings › devices (1440/390) | — | M04 | **Now covered** by its region card |
| `server-storage › div.ah-meter` | Settings › disk (1440/390) | — | M23 | **Now covered** by its region card |
| `settings-section-levy` | Settings › disk (1440/390) | — | M23 | **Now covered** by its region card |
| `storage-status` | Settings › disk (1440/390) | — | M23 | **Now covered** by its region card |
| `storage-use-alice › span` | Settings › disk (1440/390) | — | M23 | **Now covered** by its region card |
| `storage-use-alice` | Settings › disk (1440/390) | — | M23 | **Now covered** by its region card |
| `storage-use-bob › span` | Settings › disk (1440/390) | — | M23 | **Now covered** by its region card |
| `storage-use-bob` | Settings › disk (1440/390) | — | M23 | **Now covered** by its region card |
| `settings-section-editori` | Settings › editor (1440/390) | — | M13 | **Now covered** by its region card |
| `settings-section-kokeelliset` | Settings › experimental (1440/390) | — | M15 | **Now covered** by its region card |
| `settings-section-avaimet` | Settings › keys (1440/390) | — | M05 | **Now covered** by its region card |
| `settings-section-omatkoneet` | Settings › machines (1440/390) | — | M11 | **Now covered** by its region card |
| `own-machines-tailscale` | Settings › machines (390) | — | M11 | **Now covered** by its region card |
| `onboarding-access-rule` | Settings › onboarding (1440/390) | — | M21 | **Now covered** by its region card |
| `onboarding-effect` | Settings › onboarding (1440/390) | — | M21 | **Now covered** by its region card |
| `onboarding-list-label` | Settings › onboarding (1440/390) | — | M21 | **Now covered** by its region card |
| `onboarding-no-defaults` | Settings › onboarding (1440/390) | — | M21 | **Now covered** by its region card |
| `onboarding-save-state` | Settings › onboarding (1440/390) | — | M21 | **Now covered** by its region card |
| `settings-section-kayttoonotto` | Settings › onboarding (1440/390) | — | M21 | **Now covered** by its region card |
| `recap-heading` | Settings › recap (1440/390) | — | M07 | **Now covered** by its region card |
| `settings-section-tilannekatsaus` | Settings › recap (1440/390) | — | M07 | **Now covered** by its region card |
| `settings-section-palvelin` | Settings › server (1440/390) | — | M17 | **Now covered** by its region card |
| `settings-section-palvelinintegraatiot` | Settings › server-integrations (1440/390) | — | M18 | **Now covered** by its region card |
| `si-connect-note` | Settings › server-integrations (1440/390) | — | M18 | **Now covered** by its region card |
| `si-levels-note` | Settings › server-integrations (1440/390) | — | M18 | **Now covered** by its region card |
| `si-row-apple` | Settings › server-integrations (1440/390) | — | M18 | **Now covered** by its region card |
| `si-row-caldav` | Settings › server-integrations (1440/390) | — | M18 | **Now covered** by its region card |
| `si-row-carddav` | Settings › server-integrations (1440/390) | — | M18 | **Now covered** by its region card |
| `si-row-imap` | Settings › server-integrations (1440/390) | — | M18 | **Now covered** by its region card |
| `si-status-apple` | Settings › server-integrations (1440/390) | — | M18 | **Now covered** by its region card |
| `si-status-caldav` | Settings › server-integrations (1440/390) | — | M18 | **Now covered** by its region card |
| `si-status-carddav` | Settings › server-integrations (1440/390) | — | M18 | **Now covered** by its region card |
| `si-status-dropbox` | Settings › server-integrations (1440/390) | — | M18 | **Now covered** by its region card |
| `si-status-google` | Settings › server-integrations (1440/390) | — | M18 | **Now covered** by its region card |
| `si-status-imap` | Settings › server-integrations (1440/390) | — | M18 | **Now covered** by its region card |
| `si-status-microsoft` | Settings › server-integrations (1440/390) | — | M18 | **Now covered** by its region card |
| `settings-section-sanelu` | Settings › speech (1440/390) | — | M08 | **Now covered** by its region card |
| `speech-key-source` | Settings › speech (1440/390) | — | M08 | **Now covered** by its region card |
| `settings-section-saneluavain` | Settings › speech-key (1440/390) | — | M20 | **Now covered** by its region card |
| `settings-section-tila` | Settings › storage (1440/390) | — | M14 | **Now covered** by its region card |
| `storage-usage` | Settings › storage (1440/390) | — | M14 | **Now covered** by its region card |
| `trash-empty` | Settings › storage (1440/390) | — | M14 | **Now covered** by its region card |
| `worktrees-heading` | Settings › storage (1440/390) | — | T15 | **New card** |
| `access-check` | Settings › users (1440/390) | — | M22 | **Now covered** by its region card |
| `access-login-42` | Settings › users (1440/390) | — | M22 | **Now covered** by its region card |
| `access-login-43` | Settings › users (1440/390) | — | M22 | **Now covered** by its region card |
| `access-onboarding-42` | Settings › users (1440/390) | — | M22 | **Now covered** by its region card |
| `access-state-42` | Settings › users (1440/390) | — | M22 | **Now covered** by its region card |
| `access-state-43` | Settings › users (1440/390) | — | M22 | **Now covered** by its region card |
| `settings-section-kayttajat` | Settings › users (1440/390) | — | M22 | **Now covered** by its region card |
| `workspace-card-source` | Workspace front page (1440) | — | S30 | **Now covered** by its region card |
| `workspace-icon` | Workspace front page (1440) | — | S30 | **Now covered** by its region card |
| `workspace-blocker` | Workspace front page (1440/390) | — | T36 | **Now covered** by its region card |
| `workspace-icon-source` | Workspace front page (1440/390) | — | T39 | **New card** |

## Regression check

`lab-explain-coverage.spec.ts` (tag `@lab`, 12 cases) fails when a visible
control in a surveyed view has no card, neither its own nor a region's,
naming the control and its path. The allow-list with reasons is in
`web/tests/explain-coverage.ts` (the keyboard-only skip link and React Aria's
visually hidden dismiss buttons). Removing the Valmiit fold's selector (now T34) made
both workspace cases fail on that fold. It also asserts the phone drawer's close is
below the mode's bar, and that Enter in the icon wish field sends nothing in
the mode. It does not judge passive text: a new chip without a control
inside it is only caught by the inventory and review.

## Others' sections

The worktree section (`worktree-list-attention`, cards T15–T23), the composer
stack (`composer-stack-gaps-uneven`, V28) and compaction
(`compact-now-no-feedback`, K22 and K26–K29) landed on main while this work
was under way. Their cards are theirs and unchanged; this work rebased onto
them and took the next free ids (T24–T41, V29–V31). The lab's workspace page
shows no worktree section, so the survey does not reach those rows; the
storage page's worktree list is covered by its own cards and the Tallennustila
page card.

## Decisions for later review

- **Moving a conversation between the rail's lists waits in the mode**
  (Nosta, Laske, Ei nyt). Alternative: let it act like rename. Chosen because
  it is a persisted change a person exploring the rail would not expect; the
  mode's rule is that nothing lasting happens by accident.
- **Choosing a workspace icon waits** (picker choices, a suggestion, Kumoa/
  Palauta). The choice is committed to the person's repository, a lasting
  effect with undo.
- **Asking the model for icon suggestions waits** (Lähetä in the wish field,
  quick wishes, Ehdotuksia mallilta…, Yritä uudelleen) and so does Enter in
  the wish, letters, emoji and new-directory fields. Alternative: let model
  requests through since they change nothing. Chosen because they send
  workspace content to a model and cost an inference, like sending a message.
- **Cloning, cancelling a clone, retrying and creating a workspace wait.**
  The Keskeytä that only opens the question does not.
- **Rename's Save does not wait**, consistent with the existing rename cards
  (Y01, S12, T04).
- **A settings page's card now answers anywhere on the page** (rows keep no
  cards of their own, per the skill). Alternative: per-row cards. Chosen
  because the rows already describe themselves inline.
- **A generic Sulje card (P16)** covers dialog, menu, notice and background
  panel closes rather than one card per close.
- **The new-workspace page got its own group N** in the card ids.

## Evidence

`evidence/`: `workspace-explain-<card>-<width>[-en-US]` (T24 icon, T29
suggestion, T32 quick wish at 1440; T24 and T29 at 390), AVIF with a static
HTML twin, device scale 2, Finnish and US English. `hitmap-before-*` and
`hitmap-after-*`: 1440, top of the page and below the fold.

## Checks

- `./scripts/test-focused.sh --area web`: 194 files, 1463 tests passed.
- `python3 scripts/generate-ui-reference.py --check`: clean after regeneration.
- `OH_PORT_BASE=14200 OH_BROWSER_WORKERS=2 ./scripts/test-focused.sh --area browser --lab --spec lab-explain-coverage.spec.ts`: 12 passed;
  `lab-explain-mode.spec.ts`: 4 passed.
- Review: `/llm-review` of the card texts and mapping (finder gpt-6-astra, no
  verifier). 11 candidates, all confirmed against the code and fixed: missing
  waits for model requests, icon logo, Käsittele kaikki and clone retry; Enter
  bypassing waits in the new fields; T26 matching every dialog; copy that
  overstated (commit, cleanup), misnamed (Lähetä, Palauta, Vaihda kuvake) or
  mapped a passive line as a button.
