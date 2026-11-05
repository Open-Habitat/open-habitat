# Taskfleet in every installation's core runtime

Run `01m6mvnx70qw07fpb22p4afeqb`. Taskfleet is now part of the core runtime
every release carries, not an optional profile. Install and upgrade bring it;
nothing is set up per person.

## What ships

- `runtime/core/artifact-lock.json` `tools`: Taskfleet **0.18.0**
  (jarimustonen/taskfleet, MIT, commit ab9251e0) and workmux **0.1.278**
  (raine/workmux, MIT, commit b0caf23b), the official GitHub release archive
  for linux-amd64 and linux-arm64 pinned by SHA-256, with LICENSE, the released
  Cargo.lock and all 182 + 356 registry crates plus workmux's one git crate
  (crossterm, MIT). `scripts/rust-tool-lock.py` writes the record.
- The core build (`scripts/rust-tools-runtime.py`) checks every byte, that the
  crate list is exactly the Cargo.lock, each crate's own SPDX declaration and
  an allowlist (copyleft only as an unchosen OR alternative), retains each
  crate's licence files and Cargo.toml, runs both binaries against the locked
  versions and commit, and writes Taskfleet's 14 Pi skills with the pinned
  binary itself.
- Payload: `runtime/agent-bin/{taskfleet,workmux,pi}`,
  `runtime/taskfleet/skills/*/SKILL.md`, `runtime/taskfleet/extension.mjs`.
  `pi` runs the core runtime's Node/Pi with the Claude bridge and the skills
  extension; the extension offers the skills after Pi's own discovery, so a
  person's or repository's skill of the same name wins.
- Release closure (`validCoreAgentTools`): core must carry exactly these three
  commands in `agent-bin` at the pinned versions, the skills and the extension.
  `host check` row `runtime.taskfleet`: planned / installed / drift.
- Daemon: core `agent-bin` last on the agent PATH (own installs win), the
  skills extension in browser conversations, `SHELL=/bin/bash` in Pi's
  environment so Taskfleet's tmux works for nologin broker accounts.

## Evidence

- Go: `internal/host`, `internal/daemon`, `internal/cli` all pass (umask 077,
  Python `referencing` venv). New: `TestReleaseClosureCoreAgentTools`,
  `TestReleaseCoreAgentToolsObserved`, `TestReleaseClosureBuiltCore`,
  `TestAgentPathFindsCoreTaskfleet`, `TestTaskfleetSkillsExtensionFollowsAgentTools`,
  SHELL in `TestAgentCommandPathIsPerHomeAndInherited`. Builder:
  `scripts/test-profile-runtime-build.py` 14/14.
- Real core builds in disposable containers: arm64 on Birch
  (archive 453ba32e…, 20,473 files) and amd64 on Alder (7461e299…, an earlier
  revision without the extension file); both passed `TestReleaseClosureBuiltCore`
  (the release verifier's checks). Alder scratch removed.
- Disposable native run on Birch, throwaway HOME and repository, build's
  `agent-bin` last on PATH: `taskfleet run create --kind spinoff --headless`
  chose harness `pi` → the launcher, Pi 1.3.0 started in the worker pane
  ("Not logged in": no credentials in the throwaway HOME), `run list` showed
  the run, `run cancel` removed its units and tmux server. Pi RPC
  `get_commands` listed all 14 skills; with a personal `fan-out` and a project
  `stint-start` those two won. Launcher also works through a symlink.
- Not proven here: a mapped nologin account end to end, a model turn, the
  browser Workers panel on a live host. Those need the next runtime release on
  the test server. Taskfleet's own `linux-lifetime-smoke.py` from the 0.18.0
  source fails identically with the installed Fleetrepo binaries (byte-identical
  to the payload), so it is stale against 0.18.0, not a product failure.
- Review: `/llm-review` (finder claude-fable-5-1, verifier gpt-6-astra). Three
  findings, all fixed: repository skills overridden by `--skill` (replaced by
  the extension), skills and binary from different trees, launcher via symlink.
  Verifier: no cross-user or closure bypass in the change.

## Release and Fleetrepo follow-up

- The next release must be a **runtime release**: `release-cut.py` refuses a
  runtime input change. Build core natively per architecture (arm64 on Birch,
  amd64 on Alder) as `docs/operations.md` "Build and verify runtime archives".
- Fleetrepo, test server (`infra/open-habitat-test`, GUEST-TASKFLEET-RUNTIME.md):
  retire `guest_taskfleet_runtime.py`'s `/usr/local/bin/{taskfleet,workmux,pi,tmux}`
  selectors once the release is installed; they precede the release's
  `agent-bin` on the agent PATH and would keep 0.18.0/workmux 0.1.276 and the
  guest wrappers in front. Remove `guest_taskfleet_skills.py`'s `skills` entry
  from the mapped user's `~/.pi/agent/settings.json` (configured skills win over
  the release's, so stale texts would shadow them) and its host note in
  `~/.pi/agent/AGENTS.md` if it duplicates Habitat's own. The guest tmux
  wrapper's `SHELL=/bin/bash` is now set by the daemon. `integrations.json`
  `tools.pi` is rewritten by apply to the integrations profile wrapper.
- Birch: Jari's account keeps its Fleetrepo Taskfleet in `~/.local/bin`, which
  wins; Kaisa gets the release's. No unit, socket or path change needed.
- Taskfleet repository: no change needed. The Pi trust prompt for worktrees of
  repositories with protected project resources remains Taskfleet's open
  `essentially-vulgar-wealth`.

## Decisions for later review

- **Skills through a Pi extension, not settings or `--skill`.** Alternatives:
  write the catalog into each person's Pi settings (Fleetrepo's guest approach),
  or `--skill` flags. Settings writes edit a person's own config; `--skill`
  outranks personal and project skills. The extension is read-only and keeps
  Pi's native precedence.
- **workmux 0.1.278**, not the test guest's 0.1.276: Taskfleet 0.18.0 sets no
  minimum and 0.1.278 is what Alder and Birch run with 0.18.0 every day.
- **`pi` on the agent PATH.** Taskfleet's built-in Pi profile runs `pi` from
  PATH. A Habitat terminal's `pi` now also reaches the release's Pi when the
  person has none of their own.
- **Licence records, not whole crate sources.** uv's profile retains every
  crate archive; here each crate's licence/notice files and Cargo.toml are kept
  (about 1,470 files) and the allowlist has no file-level copyleft, so no source
  offer is needed. A future crate under MPL or similar is refused at build time.
- **No worker telemetry package.** `taskfleet-pi-telemetry` is a private
  repository and advisory; workers report no `worker-v1` samples.
- **pi-processes not loaded in workers' Pi.** The daemon loads it for browser
  conversations only when settings lack it; the shell launcher cannot make that
  check reliably, and workers do not need it to finish.
