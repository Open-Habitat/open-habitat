---
created: 2026-09-24
updated: 2026-09-24
type: chore
reporter: jari
status: done
priority: high
closed: 2026-09-24
closed_by: jari
---

# Disable GitHub Actions workflows

## Description

Remove the repository GitHub Actions workflows. They are repeatedly failing and generating excessive notification email. Local clean-gate verification remains authoritative until CI is deliberately restored.

## Resolution

### 2026-09-24T03:22:00Z · @jari

Removed the only GitHub Actions workflow to stop repeated failure email. Local repository gates remain available.
