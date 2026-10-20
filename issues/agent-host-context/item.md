---
created: 2026-10-20
updated: 2026-10-20
type: feature
reporter: jari
status: done
priority: high
lane: host-context
lane_seq: 1
collision: [host-context]
closed: 2026-10-20
---

# The agent knows nothing about its Open Habitat environment

_Source: chat:ville-test-2026-10-20_

## Description

Ville (second test user, 2026-10-20, pilot.237) asked his agent about his own environment — what this place is, what it can do, how workspaces, conversations, worktree agents, the editor, the browser shell, integrations, trash and storage limits work — and the agent did not know. Jari: this is a serious gap; the agent must be the person's first guide to the environment's features.

The daemon starts native Pi without any host context: no skill, AGENTS.md or appended system context describes Open Habitat. Give Pi, in every conversation the daemon starts, a native description of the host it runs on, in the way Pi itself loads context (for example a root-owned read-only skill or context file shipped with the release, selected through Pi's own mechanisms, not a parallel prompt store). It should cover what the person can do in the browser and how that maps to native things (workspaces = directories under ~/src, conversations = Pi sessions, worktree agents, Taskfleet spinoffs, integrations via personal-data skill, editor, shell, trash and quota, ~/.local/bin for user-installed tools), and where the agent cannot act. Must stay true to the code: generate or test it against the product so it cannot drift silently. Must not leak other users' data or installation secrets.

Done: a fresh conversation on the test server answers 'what can I do here / how do I X' correctly; covered by a test that fails when a described capability disappears.

## Acceptance Criteria

- [x] Every daemon-owned Pi conversation receives the release's factual English host guide, including the instruction to answer in the person's language.
- [x] The pinned native Pi test proves fresh and resumed requests contain the guide alongside personal/project AGENTS, personal APPEND_SYSTEM and discovered skills, without changing native settings.
- [x] A capability contract fails when advertised service mounts or the shared route's worktree/Trash operations disappear.

## Result

`internal/daemon/host-context.md` is runtime input embedded in the product binary: the installed root-owned, read-only release is the source, with no persistent per-user guide or settings copy. Each Pi launch gets a private, read-only, child-lifetime extension artifact in its existing process directory. Pi's native `before_agent_start` hook adds the `open_habitat` prompt section; the artifact is removed with the child. This deliberately avoids `--append-system-prompt`, which Pi 1.3 uses instead of the person's discovered APPEND_SYSTEM.md. No Fleetrepo wiring or additional installation file is needed.

The guide covers native workspaces and Pi histories, worktree agents and Taskfleet observation, editor/tmux shell, personal-data integrations, Trash/quota, personal tool installation, and authority limits. It contains no installation addresses, identities, credentials or other users' data. The browser does not offer a worktree merge control: the guide directs merging to Git/the agent.

Validation on the implementation tree (the fixing commit carries these results):

- `npm ci --prefix internal/daemon/pi-device-test --ignore-scripts` — passed, pinned Pi 1.3.0.
- `umask 077; TMPDIR=/var/tmp ./scripts/test-focused.sh --area go --go-package ./internal/daemon` — passed with race detection, including the real pinned Pi + synthetic provider fresh/resume composition test and the capability contract.
- `TMPDIR=/var/tmp ./scripts/test-focused.sh --area contracts` — passed (54 schemas, 51 fixtures, 36 scenarios, 17 negative checks).
- `python3 scripts/validate-project-view.py`, `issuectl doctor --json`, `git diff --check` — passed.

Focused self-review was proportionate: this changes a static guide and a native prompt-section addition, not Unix identity, gateway/daemon/broker authority or installation hardening. Reviewed the described features against their handlers, Taskfleet read-only behavior, personal-data skill generation and agent PATH. Existing package tests cover the surrounding launch/ownership behavior. No browser UI was changed, so lab screenshots would not show this change. No full clean gate or deployment was attempted, as requested.

Failed/incomplete commands: the first daemon run inherited umask 0002 and failed numerous permission-sensitive synthetic-home/socket fixtures; rerunning with umask 077 resolved those. The next daemon run and the focused native test exposed a test-provider decoding mistake (user message content can be an array); the fixture now decodes only system/developer content as strings, and the final complete daemon suite passed. Exploratory reads of guessed, nonexistent paths were replaced with the actual implementation paths; no required discovery or check remains blocked.

Live verification remains the conductor's step: deploy the new product binary, start a fresh browser conversation, ask in the person's language what can be done here and how to use workspaces, integrations and Trash. The synthetic provider verifies the context delivered to Pi, not a real model's wording or live-server behavior. This worker neither pushed nor touched the test server.
