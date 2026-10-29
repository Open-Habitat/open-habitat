---
created: 2026-10-29
updated: 2026-10-29
type: bug
status: untriaged
priority: normal
provenance: other
provenance_detail: taskfleet run 01m64kr0dj2mqbxncdtde7vkb1 (observed in harness smoke)
source_ref: taskfleet:01m64kr0dj2mqbxncdtde7vkb1/claude-worker-first-run-onboarding
originating_run: 01m64kr0dj2mqbxncdtde7vkb1
originating_run_kind: spinoff
---

# Claude Code worker stops at Claude Code's first-run theme picker on an account signed in only through Habitat

## Description

## Observation

On the Open Habitat test server (29.10.), after `claude` was put on the agent PATH, an interactive `taskfleet run create --harness claude` smoke run under the mapped user `maintainer` launched Claude Code successfully. The worker then stopped at Claude Code's first-run onboarding screen (theme picker: "Dark mode / Light mode …", syntax-theme preview) instead of starting on the task. The account signed in to Claude through Habitat, so `~/.claude/.credentials.json` exists. `~/.claude.json` exists but has no `hasCompletedOnboarding`. Claude Code has never been run interactively on that account.

An autonomous Claude Code worker on such an account therefore waits at an interactive prompt that no one sees, until the startup or check-in times out.

Fleetrepo run `01m64kr0dj2mqbxncdtde7vkb1`. The test run was cancelled and its repository removed. The person's Claude configuration was not changed, so the state is still there to reproduce.

## Likely cause

The product's Claude sign-in (`internal/daemon/claude_login_linux.go`) creates Claude Code's credentials but not the CLI's first-run state. A person who signs in only through Habitat (the expected path on a customer installation) has never completed Claude Code's interactive onboarding. Workers are the first interactive Claude Code launch on that account.

## Expected

A Claude Code worker started on an account that signed in through Habitat begins work without an interactive first-run step. Possible fixes: the sign-in completes the CLI's onboarding state, or the worker launch passes what Claude Code needs to skip it. Which one belongs here, and which in Taskfleet's claude harness, is open.
