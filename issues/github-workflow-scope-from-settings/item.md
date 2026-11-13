---
created: 2026-11-13
updated: 2026-11-13
type: feature
status: open
priority: normal
preparation: ready
lane: code-hosts-github-scope
lane_seq: 1
---

# Renew the GitHub connection with the workflow permission from Settings

## Observed

Pushing a new `.github/workflows/*.yml` from an agent failed: GitHub refused
it because the account's GitHub token lacks the `workflow` scope. Habitat's
GitHub sign-in requests `repo read:org gist` (`internal/gateway/github.go`)
and installs that token for the native `gh` (`internal/nativegh`). The only
fix was running `gh auth refresh -s workflow` in the terminal (device code in
the browser), which a later Habitat sign-in may overwrite.

## Expected (Jari 13.11.2026)

The person can renew the GitHub connection with the extra permission from
Habitat's own interface (Settings › Code hosts), as with any sign-in, instead
of a terminal command.

## Design question

`workflow` lets an agent change CI that can read repository secrets, so it
should stay off by default: an opt-in on the GitHub card ("Allow agents to
change GitHub Actions workflows") that re-runs the sign-in with the added
scope and shows which scopes the token has. Prototype first.
