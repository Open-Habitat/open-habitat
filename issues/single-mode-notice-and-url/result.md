# Result

The single-workspace home now uses `/`. `/workspaces` remains an accepted alias and is replaced, not pushed, in browser history when the inventory confirms one visible workspace. Workspace links without a conversation similarly replace with `/`; conversation links keep their workspace ID and full query, and reloading or Back/Forward preserves the selected conversation. The top bar links directly to `/` and marks it current.

The archive warning uses the same 860px centred column as the workspace page, including on narrow screens.

## Archive investigation (read-only live inspection)

The warning is warranted, not caused by idle Pi children. On pilot.231, journal inspection showed the separate conversation-creation 429 but no archive-specific error in the inspected last 300 daemon records. A bounded read of native session **headers** and presentation annotations found 31 distinct session IDs, no duplicate IDs or malformed headers, and 27 archived annotations, all with a native header. Two of those archived sessions refer to directories that no longer exist under `~/src`; both directory names have counterparts in freedesktop Trash. No live message bodies were read, no live screenshots captured, and nothing was changed or restarted.

The snapshot maps native sessions only to discovered workspace/worktree paths. Those two archived histories therefore have no mapped agent in the snapshot. Its orphan-archive check deliberately emits `pi_history: unknown` for this situation. That is exactly what the browser's notice represents: the visible archive cannot claim to be complete. Do not suppress it, delete the annotations, or start Pi to make the notice disappear. Restoring the relevant workspace is the existing way to make its archive visible again.

## Decisions for later review

- Use `/` as the canonical single-workspace home, rather than renaming all multi-workspace routes. Keep `/workspaces` and existing workspace/conversation deep links accepted; redirects replace history so Back is not caught in aliases. The single-mode top bar goes directly home; multi-workspace navigation remains unchanged.
- Retain the archive warning for archived native histories whose workspaces are in Trash. Omitting it would falsely claim the visible archive is complete. No host/state changes are needed for this issue.

## Verification

- `scripts/test-focused.sh --area browser --spec single-workspace-mode.spec.ts`: **5 passed**, including axe, one↔two-workspace transitions, hidden-workspace restoration, deep-link reload, Back/Forward and notice geometry in six width/theme combinations.
- Fast web checks: format, lint, typecheck, **244 unit + 174 component tests passed**.
- `lab/single-home-notice-{wide,narrow,phone}-{light,dark}.avif` and adjacent static HTML: six synthetic lab views at 1920×1080, 1000×900 and 390×844. Only the source observation is injected as `pi_history: unknown`; the page and identity remain host-backed. These are not live screenshots.
- Source tested/captured: `ff9fe451`, with the final capture helper in this result's commits. Visually reviewed all six views. `python3 scripts/validate-project-view.py`, `issuectl doctor --json` and `git diff --check` also passed (doctor retains repository-wide pre-existing raster advisories).

## Failed attempts and review limits

An initial competing legacy root redirect caused alias churn and broke Back/Forward and restoration. The final implementation chooses the canonical home in one effect; the complete spec now passes. A retained failure trace was inspected with `scripts/inspect-trace.sh --json`; no missing evidence remains. The geometry fixture injects the unknown source rather than claiming to reproduce the real orphaned sessions. Read-only VM investigation succeeded; it establishes the current native orphan condition, not the exact source state at the instant of Jari's earlier screenshot. No live browser verification, deployment, full gate or UID-isolation verification is claimed.
