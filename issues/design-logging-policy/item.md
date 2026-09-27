---
created: 2026-09-27
updated: 2026-09-27
type: task
status: done
priority: normal
lane: logging-design
collision: [docs/]
closed: 2026-09-27
closed_by: pi
---

# Define Omega Habitat logging philosophy

## Description

Jari requests a coherent, comprehensive logging philosophy grounded in real first-login investigations: specify event taxonomy and authority per gateway/broker/daemon/ingress, structured JSONL fields and privacy exclusions, attempt correlation across authenticated internal boundaries, retention/access controls, bounded volume and failure behavior, operator diagnosis and user-safe support reference, tests for no secret/identity leakage, and a prioritized migration from current behavior. Propose policy for Jari to approve; do not silently change auth architecture, production code or test host. Read incident analyses, AGENTS.md and docs/product.md. Distinguish portable product rules from Fleetrepo-specific operations. Output a concise recommendation in docs/; no raw private logs.
