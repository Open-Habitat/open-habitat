---
created: 2026-10-29
updated: 2026-10-29
type: feature
reporter: jari
status: done
priority: normal
lane: proto-experimental-features
lane_seq: 1
preparation: pending
closed: 2026-10-29
---

# Prototype: Kokeelliset ominaisuudet settings section

_Source: chat_

## Description

Jari 29.10.: some features ship as **kokeellisia ominaisuuksia** (experimental features), each with its own on/off switch in a new Kokeelliset ominaisuudet section in settings. The first three: the "next waiting conversation" row at the end of a conversation (`next-waiting-row-experimental`), the worker row's work sentence (`worker-row-sentence-experimental`) and the read-only terminal mirror (`terminal-watch-experimental`).

Prototype round (design-system/prototypes method: 2–3 directions on one axis, production settings context, desktop and phone, light and dark, synthetic data, one offline file): what the section looks like, how each feature is explained (what it does, what it shows, that it may change), whether a switch takes effect immediately, and whether an enabled experimental feature is marked where it appears. Record in result.md the host facts: where the switches are stored (an existing account-backed preference such as the editor preference, not a new store), per account or per browser.

## Decisions

### 2026-10-29T13:36:58Z · @jari

Jari 29.10.: Esittely. The status message that changes with each click is unnecessary, too much detail and repetition: drop it. Implementation: experimental-features-section.
