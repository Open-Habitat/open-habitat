# Result

`open-habitat agent view offer --current` now takes the workspace from the
checked launch context (`OPEN_HABITAT_WORKSPACE_ID`) when `--workspace` is not
given, as the removed editor offer did. An explicit `--workspace` still wins
and is still validated. The conversation target is resolved before the
workspace, so outside a daemon-launched Pi `--current` says
`current_context_unavailable` instead of a misleading `invalid --workspace ""`.
The help, agent skill and host context examples drop `--workspace`.

Evidence: `go test ./internal/cli` (`TestViewOfferCurrentResolvesWorkspace`
covers the default, the missing context and an explicit malformed workspace).
The default is the launch context's own workspace, and the daemon refuses a
`--current` context whose workspace is not the live session's
(`current_context_stale`), so the default cannot select another workspace. An
explicit `--workspace` may still name any of the person's own workspaces, as
before.
