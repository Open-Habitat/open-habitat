---
created: 2026-10-29
updated: 2026-10-29
type: task
reporter: jari
status: open
priority: normal
lane: account-secrets
lane_seq: 1
preparation: pending
---

# Research: SOPS, age and SSH keys on the Habitat account (UI or CLI)

_Source: chat_

## Description

Jari 29.10. (from `research-ville-feedback`, item 2): the same things may be on a person's Habitat account as on their laptop, deploy credentials included. Could there be a UI for handling SOPS, or CLI tools for it?

Research: what a person needs to bring a laptop's secret setup to the account (age key generated on the account and added as a recipient by the organisation, SSH keys, `.sops.yaml` rules, decrypting for a deploy), what native tools exist (sops, age, ssh-keygen, `gh`, 1Password/Bitwarden CLIs), what Open Habitat ships in its runtime profile, and whether a UI is worth it (e.g. a Keys/Avaimet settings page showing the account's public age and SSH keys with a copy button and where they are used) versus an agent skill plus CLIs. Unix user boundary and "no credential broker of our own" hold: private keys are created on the account and never leave it; the product shows public halves only.

## Acceptance Criteria

- [ ] `report.md` (sourced) and `result.md` with a recommendation (UI, skill + CLI, or both), what ships in the runtime profile, and a proposed prototype or implementation issue.
