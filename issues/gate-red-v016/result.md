# Result: the seven browser failures

All seven came from intended changes whose tests were stale. None is a product
regression, so only tests changed.

| Test | Decision | Why |
|---|---|---|
| `browser-editor.spec.ts:523` duplicate `navigation-open` | Test race; scope the locator | Beside an open editor the desktop rail is collapsed, and its toggle uses the `navigation-open` test id. Right after the resize to 390 px, the collapsed rail is still mounted for one render, off-canvas and hidden, while the phone toolbar's opener appears. Strict mode fails at once. Only one opener is ever visible: the failure's accessibility snapshot shows just the toolbar button, and `collapsed` is `railCompact && !mobileLayout`. The test now takes the opener from `#main`, which is the toolbar's. |
| `first-use-ux.spec.ts:177`, `github-stream.spec.ts:34`, `site-ai-key.spec.ts:94`: no `workspaces-title` | Stale expectation | Graduating agent instructions made the note for the agent the onboarding route's last step whenever repositories were chosen (`instructionsStep = !skipChooser`). The heading is still there. The failure snapshot shows the route waiting at "Muistilappu agentille". The tests now leave the note for later and enter Habitat through a shared `skipAgentNote` helper, the same path the graduation already gave `pi-onboarding-host.spec.ts`. The first-use promptness bound (4.5 s) now measures the arrival of the note step, which is what completion now shows. |
| `lab-english-url-paths.spec.ts:13` `/settings/sounds` | Stale expectation | Sounds graduated to an ordinary settings page after Appearance. Added to the slug list. |
| `lab-sidebar-default.spec.ts:8` 6 vs 7 workspace actions | Stale expectation | The graduation removed `rename-workspace` from the action group because renaming now happens in the workspace strip's name. Both counts are now 6. |
| `lab-workspace-icons.spec.ts:44` no icon in the running row | Stale expectation | The test's wire seam marks each new conversation's worker as idle at its prompt. Since "give stopped workers back to the person", such a conversation is the person's turn and sits in Sinun vuorosi, not Käynnissä. The icon button is present there. The test reads `rail-yours`, including the collapsed-strip check. |

## Verification

Evidence logs are in `/var/tmp/agent-keep/gate-red-v016/fix/` (outside the
tree).

- The two exact rerun commands from the brief passed three times in a row (4/4 and 3/3 each time; `ord1..3.log`, `lab1..3.log`).
- These whole specs plus same-test-id siblings passed once with two workers:
  - ordinary, 73 passed: browser-editor, first-use-ux, github-stream, site-ai-key, agent-instructions, github-first-onboarding, pi-onboarding-host, round4-polish, workspace-slice, rail-icons-quiet, rail-groups, settings-search, settings-selectors
  - lab, 37 passed: lab-english-url-paths, lab-sidebar-default, lab-workspace-icons, lab-en-workspaces, lab-explain-coverage, lab-onboarding, lab-worktree-containers, lab-workspace-page, lab-sidebar-account
- `./scripts/test-focused.sh --area web` passed.

## Decisions for later review

- **`navigation-open` names two controls**: the rail's collapsed toggle and the phone toolbar's opener. That is unchanged product behaviour. Alternatives were to rename one id or to unmount the collapsed toggle at once on resize. Neither is visible to people, and renaming would ripple through about fifty specs on release night. Scoping the one test was the proportionate fix. A rename could be a later cleanup.
- **Other specs that use `navigation-open` unscoped were not rerun.** About fifty specs touch the id. The clean gate ran all of them on main, and only this one failed. This change touches tests only, so those results still hold.
- **The issue stays open** for the Go `internal/daemon/integrations` flake it also records. The release driver owns that flake. The browser part is done.
