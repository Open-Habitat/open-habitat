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

Web search comes from the provider the person already uses (Jari,
2026-11-10): `web-search.mjs` adds the provider's own search tool to Pi's
requests, and the build lets the Claude bridge's Claude Code run its own
WebSearch and WebFetch. A person's own search tool takes precedence, and no
keyless third-party search is turned on by default: it would send queries to a
company nobody chose, under one rate limit shared by the whole installation. The bridge change is
a source patch that must apply exactly once, so a bridge pin bump either
carries it forward or drops it on purpose once upstream offers the setting.

Agents read JavaScript-rendered pages with `page-reader.mjs` and the headless
Chromium in `browser-lock.json`, which every installation gets (Jari,
2026-11-10). The browser profile's QA Playwright uses the same shell, so its
wheel must name the core lock's browser revision. Chromium never runs without
its sandbox. Where the installation's AppArmor profile is missing, the tool
refuses and says why: a renderer exploit outside the sandbox would run as the
person, with their credentials. Pages are rendered on the host, never by a
hosted renderer, which would see every URL a person's agents read.

Taskfleet and workmux are upstream release binaries, locked with their
LICENSE, the Cargo.lock they were released from and every crate's SPDX
licence; `scripts/rust-tool-lock.py` writes that record. Raising a pin means
regenerating it, and the build refuses a crate licence outside the allowlist
in `scripts/rust-tools-runtime.py` rather than shipping it. The versions the
release verifier accepts are `CoreAgentTools` in `internal/host`.
