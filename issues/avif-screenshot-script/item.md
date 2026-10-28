---
created: 2026-10-28
updated: 2026-10-28
type: chore
reporter: conductor
status: done
priority: normal
provenance: chat
source_ref: worker:r30-research-alder-pi-plugins/avif
lane: prototype-tooling
lane_seq: 1
preparation: ready
closed: 2026-10-28
---

# Script to convert prototype/evidence screenshots to AVIF without rm on variable paths

## Description

A prototype worker (r30-research-alder-pi-plugins, 28.10.) converted 72 PNG screenshots to AVIF with xargs + sh -c 'convert "$1" && rm -- "$1"', an rm with a variable path that briefs forbid. It was safe this time, but issuectl doctor's non-AVIF advisory pushes every prototype round toward the same step. Give workers scripts/screenshots-to-avif.py (or a verify.mjs helper in design-system/prototypes/lib) that converts named files inside an issue's evidence directory and removes only the exact converted sources, and name it in design-system/prototypes/AGENTS.md.
