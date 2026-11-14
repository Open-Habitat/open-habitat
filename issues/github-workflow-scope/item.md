---
created: 2026-11-14
updated: 2026-11-14
type: feature
status: open
priority: normal
preparation: ready
lane: code-hosts-github-scope
lane_seq: 2
---

# GitHub card: allow agents to change workflows (opt-in, remembered)

## Goal

Implement the accepted prototype `design-system/prototypes/rounds/2026-11-13-github-workflow-scope/`, direction A Rivi (see `issues/github-workflow-scope-from-settings/result.md`): on Settings › Code hosts' GitHub card, a row of its own lets the person allow agents to change GitHub Actions workflows. Off by default; turning it on re-runs the GitHub sign-in with `workflow` added; the card shows the token's scopes; Habitat remembers the opt-in so a later sign-in that drops the scope shows "permission missing" and offers to restore it; removing it does not revoke the old token. Accepted by Jari after the prototype: not an experimental feature.
