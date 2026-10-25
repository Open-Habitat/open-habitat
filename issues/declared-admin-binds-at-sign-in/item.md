---
created: 2026-10-25
updated: 2026-10-25
type: bug
status: fixed
priority: normal
preparation: ready
provenance: other
lane: unlaned
collision: [internal/gateway/administration]
closed: 2026-10-25
---

# Declared administrator is not an administrator after first sign-in

## Description

Observed 2026-10-25 on Birch (pilot.10): the site declaration names maintainer (GitHub id 1272053) as administrator, but after his first sign-in he was not an administrator: the role stays `deferred_until_bound` until the next approved `host apply`, so a fresh installation's declared administrator signs in and has no Palvelimen ylläpito. The conductor granted it by hand (`open-habitat admin role update 1272053 --administrator true`). The installer handoff wrongly told Jari the first sign-in would make him administrator.

## Goal

A declared administrator gets the role when their account is bound at first sign-in, without a further host apply or a manual role command, keeping the same authority split (the declaration is the operator's; the gateway applies it only to the declared subject after binding).

## Acceptance Criteria

- [x] Fresh install: the declared administrator's first sign-in shows Palvelimen ylläpito.
- [x] An undeclared person never gains the role; existing installations unaffected.
