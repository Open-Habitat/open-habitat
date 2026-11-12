---
created: 2026-11-12
updated: 2026-11-12
type: improvement
reporter: jari
status: open
priority: normal
provenance: chat
source_ref: chat:2026-11-12/openpyxl
lane: unlaned
preparation: ready
---

# Python document libraries (openpyxl and kin) on every installation

## Description

Jari 12.11.2026: Contoso's server lacked Python's `openpyxl` (an agent needed
it for Excel files); "it should probably be everywhere". Birch lacks it too
(`python3 -c "import openpyxl"` fails). The core runtime's Ubuntu
requirements (`runtime/core/ubuntu-packages.json`) carry no Python document
libraries; every installation gets the core profile.
