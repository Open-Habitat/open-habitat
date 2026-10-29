---
created: 2026-10-29
updated: 2026-10-29
type: feature
reporter: jari
status: open
priority: normal
lane: account-secrets
lane_seq: 3
preparation: ready
---

# Asetukset › Avaimet: account SSH and age keys (Taulukko)

_Source: chat_

## Description

Implement `proto-account-keys-page` direction **Taulukko** (Jari 29.10.): Asetukset › Avaimet lists the account's SSH and age keys in one table with expandable rows (public half derived from the private file, fingerprint, copy, "give this to your administrator" text), creates a key when none exists (private half never leaves the account or reaches the browser), and marks a key the person has not seen (seen fingerprints kept where the agent cannot write, as the prototype result recommends). Agent skill section from `research-account-secrets` (create keys on the account, never print `keys.txt`, how an organisation adds the account as a device). Runtime profile gains `sops` (exact upstream artifact, amd64 and arm64) and names `openssh-client`.

## Acceptance Criteria

- [ ] Keys page as the prototype's Taulukko, from native files; key creation through the person's daemon.
- [ ] Skill text and runtime profile change.
- [ ] Contract, daemon and browser tests; KOKEILTAVAA line.
