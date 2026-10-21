---
created: 2026-10-21
updated: 2026-10-21
type: feature
status: untriaged
priority: normal
provenance: other
provenance_detail: ADR 0028 implementation phase under Jari's delegated decision
source_ref: taskfleet:01m5fs673v3g8t13brvtj4erzt/implementation-phase:1
originating_run: 01m5fs673v3g8t13brvtj4erzt
originating_run_kind: technical-decision
related: ['@decide-editor-choice']
---

# Add confined editor file API and CodeMirror 6 default

## Description

## Description

Implement phase 1 of ADR 0028 (`docs/decisions/adr-0028-selectable-workspace-editor.md`): a shared confined daemon text-file API, identity-local Editori preference, and CodeMirror 6 as the default browser editor, alongside existing VS Code. Jari approved this direction on 2026-10-21. The current WorkspaceEditor gates all editor/file-link availability on code-server; lightweight text editing and phone use must not require that process.

The ADR specifies the contract and limits. Add read, save-existing, stat and bounded one-directory list under `/api/v1/workspaces/editor/`; generate contracts from contracts/v1. Resolve workspace/worktree IDs through held-workspace admission, pin all I/O to descriptors/os.Root with no symlink or mount crossing, and extend managed-deletion fencing with operation leases. Bound UTF-8 text and wire sizes. Save uses a combined hash/inode/metadata version, serialized same-parent staged replacement preserving ordinary mode/group, durability handling and honest uncertainty; refuse hardlinks and security metadata that cannot be preserved. Native uncooperative writes can still race the final check/rename: do not claim global CAS or add force-overwrite/retry.

Store only editor enum in browser localStorage keyed by validated web_identity_id; fall back to in-memory/CodeMirror when unavailable. Reset live buffers on identity changes. Settings lists three options, but Monaco is visibly not yet available until phase 2. Compact/phone layout uses only CodeMirror without overwriting desktop preference. Dirty document transitions require save or explicit discard.

Reuse WorkspaceEditor's split, editor-local header, full-window return routes and conversation file links, adding one-document browser-editor adapter, bounded file picker, Save/conflict handling and token-derived light/dark themes. Lazy-load CodeMirror and grammar modules. Initial syntax scope: text, Markdown, JS/TS/JSX/TSX, JSON, HTML, CSS, Go, Python, shell and YAML. Treat file text as data, never a preview or executable plugin. All saves go through mutations.ts. Opening CodeMirror, settings and status must never start code-server; switching away does not kill a process another tab may use.

## Acceptance Criteria

- [ ] Generated request/result/error contracts enforce the ADR's path/type/size/encoding rules and fixed errors; gateway only authenticates/bounds/relays, daemon owns all filesystem authority.
- [ ] Daemon tests demonstrate traversal, symlink/mount and parent swaps, FIFO/device refusal, foreign ownership, deletion leases, hardlink/xattr/ACL/read-only refusal, executable mode preservation, strict pre-decode Unicode/surrogate validation, UTF-8/BOM/newlines, caps, stale tokens, two consecutive saves (post-rename ctime tokens), simultaneous saves through alias workspace/place IDs, overlapping workspace/place deletion leases and full-disk/fsync uncertainty.
- [ ] Distinct-UID VM evidence proves a browser cannot select another person's daemon/workspace; do not substitute same-UID fixtures for this proof.
- [ ] Host-backed browser tests cover default and identity-local settings, identity reset/stale responses, dirty transitions, explicit save/conflict/reconciliation, file links/ranges, editor header/full-window/focus, both themes and 390px phone picker/Save ergonomics.
- [ ] Production asset evidence records initial and CodeMirror compressed sizes and confirms no eager Monaco engine/workers and no code-server starts for CodeMirror; unsupported files fail explicitly without active-content rendering.
- [ ] Existing VS Code origin/session isolation and lazy start still work. Update KOKEILTAVAA.md with a Finnish test checklist. This phase lands without Monaco.
