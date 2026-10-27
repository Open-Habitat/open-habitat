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
The daemon still checks that the workspace's directory is the live
conversation's cwd before exporting, so the default cannot point the offer at a
different workspace's files.
