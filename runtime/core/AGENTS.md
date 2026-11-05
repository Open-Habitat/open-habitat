# Core runtime build inputs

The core runtime is what every installation gets from install and upgrade,
with no profile to select and nothing to set up per person. Node and Pi live
here, and so do Taskfleet, the workmux it creates worktrees with, Taskfleet's
bundled skills and the `pi` launcher in `agent-bin/` (Jari, 2026-11-05):
agents in every installation are told to delegate work through Taskfleet, and
a missing Taskfleet sent them to background workarounds that hold a
conversation and never reach the Workers panel. Keep them out of optional
profiles.

`runtime/agent-bin` in the payload is the directory the daemon puts last on
agents' `PATH`, so it holds only commands meant for agents and the release
closure refuses anything else there. A person's own installation of any of
them comes first and is never replaced or edited, and nothing writes their Pi
settings. The skills reach Pi through `taskfleet-skills.mjs`, an extension that
offers them after Pi's own discovery, so a person's or repository's skill of
the same name wins; `--skill` flags would outrank both. Taskfleet's skills are
written by the pinned Taskfleet binary at build time, never copied from a
machine's installed skills.

Taskfleet and workmux are upstream release binaries, locked with their
LICENSE, the Cargo.lock they were released from and every crate's SPDX
licence; `scripts/rust-tool-lock.py` writes that record. Raising a pin means
regenerating it, and the build refuses a crate licence outside the allowlist
in `scripts/rust-tools-runtime.py` rather than shipping it. The versions the
release verifier accepts are `CoreAgentTools` in `internal/host`.
