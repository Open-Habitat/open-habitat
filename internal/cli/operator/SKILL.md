---
name: operator
description: Operate and diagnose Open Habitat runtime roles non-interactively.
cli_version: "0.0.0-dev"
schema_version: 1
---
# Open Habitat operator

Inspect configuration before starting a role. Prefer structured output:
    open-habitat --json doctor --component gateway
Never infer readiness from process liveness alone.
