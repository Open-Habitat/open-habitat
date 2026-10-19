# Result

The single-workspace home now uses `/`. `/workspaces` remains an accepted alias and is replaced, not pushed, in browser history when the inventory confirms one visible workspace. Workspace links without a conversation similarly replace with `/`; conversation links keep their workspace ID and full query, and reloading or Back/Forward preserves the selected conversation. The top bar links directly to `/` and marks it current.

The archive warning uses the same 860px centred column as the workspace page, including on narrow screens.

## Archive investigation (read-only live inspection)

The warning is warranted, not caused by idle Pi children. On pilot.231, journal inspection showed the separate conversation-creation 429 but no archive-specific error in the inspected last 300 daemon records. A bounded read of native session **headers** and presentation annotations found 31 distinct session IDs, no duplicate IDs or malformed headers, and 27 archived annotations, all with a native header. Two of those archived sessions refer to directories that no longer exist under `~/src`; both directory names have counterparts in freedesktop Trash. No live message bodies were read, no live screenshots captured, and nothing was changed or restarted.

The snapshot maps native sessions only to discovered workspace/worktree paths. Those two archived histories therefore have no mapped agent in the snapshot. Its orphan-archive check deliberately emits `pi_history: unknown` for this situation. That is exactly what the browser's notice represents: the visible archive cannot claim to be complete. Do not suppress it, delete the annotations, or start Pi to make the notice disappear. Restoring the relevant workspace is the existing way to make its archive visible again. The two missing working directories predate this run; the fresh archive operations are not sufficient to explain them.

## Decisions for later review

- Use `/` as the canonical single-workspace home, rather than renaming all multi-workspace routes. Keep `/workspaces` and existing workspace/conversation deep links accepted; redirects replace history so Back is not caught in aliases. The single-mode top bar goes directly home; multi-workspace navigation remains unchanged.
- Retain the archive warning for archived native histories whose workspaces are in Trash. Omitting it would falsely claim the visible archive is complete. No host/state changes are needed for this issue.

## Verification

Pending final focused checks and synthetic lab captures. No live browser verification or deployment is claimed.
