---
created: 2026-11-21
updated: 2026-11-21
type: feature
reporter: jari
status: obsolete
priority: normal
lane: terminal-settings
lane_seq: 1
preparation: ready
closed: 2026-11-21
---

# Prototype: terminal settings page (copy on select off by default)

## Goal

A configuration page for the terminal. Jari 21.11.2026: copying on select (today the experimental `terminal-copy-on-select`) is odd for ordinary users, so it becomes a configurable terminal setting, off by default; the page also gathers the other terminal configuration. Prototype it first.

## Decisions

- Jari 21.11.2026: prototype the terminal configuration page; copy on select is a setting, off by default.

### 2026-11-21T15:33:47Z · @jari

Jari 21.11.2026: C is right, but the terminal's gear should only open the Settings page. Text size needs a preview. Riff again.

### 2026-11-21T18:43:07Z · @jari

Jari 21.11.2026: drop the whole terminal settings view; no terminal settings for now, and remove copy on select entirely — it is only confusing for our users.

## Agent Runs

### 2026-11-21T14:59:59Z · @claude

Prototype round 1 (run 01m7z93caj8vp9epxz4fa3k0hw): round 2026-11-21-terminal-settings, directions A Osio / B Ratas / C Esikatselu, recommends C; see result.md. Waiting for Jari's choice.

### 2026-11-21T15:48:38Z · @claude

Prototype round 2 (run 01m7zbxvj99khkk454qywnff7b): round 2026-11-21-terminal-settings-2. One view, Settings › Pääte, with the gear only navigating. Text size variants: A slider, B stepper with ruler and columns, C presets. Recommends B; see result-2.md.

## Resolution

### 2026-11-21T18:53:00Z · @issuectl

Withdrawn by Jari on 2026-11-21: no terminal settings view for now. Both prototype rounds retired to Git history; automatic copy-on-select removed throughout the product, while explicit copying remains. See result.md for verification and the separately filed baseline layout failure.
