---
created: 2026-10-25
updated: 2026-10-25
type: improvement
reporter: jari
status: open
priority: normal
lane: proto-settings
lane_seq: 1
---

# Prototype grouping of AI, code-host and data integrations in settings

## Description

Jari, 2026-10-25: "Musta muuten Integraatiot-välilehti on tälle outo paikka. Github on yhteydet-osiossa, mutta sekin on musta sekava. Pitäisikö olla oma sivu AI-integraatioille ja oma sivu git-integraatioille tai jotakin sellaista. Pitäisikö tämä jaoittelu prototyypata." (In short: the Integraatiot tab is an odd place for Gitea; GitHub sits under Yhteydet, which is also confusing; maybe separate pages for AI integrations and git integrations; should the grouping be prototyped?)

Today the settings pages are grouped this way: Yhteydet (AI providers and GitHub, reached from the model selector) and Integraatiot (data sources such as Google, Microsoft, IMAP/DAV, Dropbox and iCloud, plus Gitea). Code hosts are split across both.

## Goal

Run a prototype round on how settings group connections by what they are for the person, for example:
1. AI models and provider sign-ins,
2. code hosts (GitHub, Gitea) and the workspaces imported from them,
3. data sources for agents (mail, calendar, files).

Compare at least two or three groupings, including where onboarding and the model selector link to. Present them to Jari for a verdict before any production change.

## Acceptance Criteria

- [ ] Prototype variants with notes, and Jari's verdict recorded.
