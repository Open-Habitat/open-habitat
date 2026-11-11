---
created: 2026-11-11
updated: 2026-11-11
type: task
reporter: jari
status: open
priority: normal
related: ['@web-search-native']
preparation: ready
lane: bridge-upstream
lane_seq: 1
---

# Upstream PR: pi-claude-bridge provider.builtinTools (web search on the Claude subscription)

## Description

Jari 11.11.2026: open a pull request to `elidickinson/pi-claude-bridge` that
adds a `provider.builtinTools` setting (default `[]`) passed to Claude Code's
`tools` on the provider path, so a Pi session on the Claude subscription can
use Claude Code's WebSearch/WebFetch. The proposal text and the verification
are in `issues/web-search-native/result.md` (upstream issue text section).
Fork under Jari's GitHub account, implement with the bridge's own tests,
open the PR, record its URL here.

Until upstream ships it, Open Habitat carries the one-line build patch
`BRIDGE_PATCH` in `scripts/core-runtime-build.py` (the build fails if it does
not apply exactly once). That rule belongs in `scripts/AGENTS.md`: every
bridge version bump re-applies the patch, and once upstream has the setting
the patch is replaced by the setting in the shipped configuration.
pilot.27 carries the patched bridge to every installation.
