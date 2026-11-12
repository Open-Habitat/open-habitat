---
created: 2026-11-12
updated: 2026-11-12
type: bug
reporter: jari
status: open
priority: normal
provenance: chat
source_ref: chat:2026-11-12/file-offer-relative
lane: unlaned
preparation: ready
---

# file/view offer resolves a relative --source against the workspace root, not the shell's cwd, and the error does not say so

## Description

Jari 12.11.2026 relayed another agent's finding (fleetrepo conversation on
Birch): `open-habitat agent file offer --source <relative path>` failed with
`file_source_not_found`; the message did not say that the path must be
absolute or what a relative path is relative to. The absolute path worked.

Cause (code): the daemon resolves a relative source against the
conversation's opened workspace root (`offeredSource` /
`internal/daemon/views_linux.go`), not against the shell's working directory
where the agent ran the command. An agent that has `cd`'d elsewhere (or works
in a sibling repository) gets a not-found for a file that exists. The same
applies to `agent view offer`.

Expected: a relative `--source` means what it means in every shell command:
relative to the command's own working directory. The CLI runs as the person
and can make it absolute before sending. When a source is still not found,
the error names the resolved path it looked for.

The agent also said Open Habitat had no "intake key" for it to file this, so
it proposed filing in Fleetrepo; recorded here instead.
