---
name: operator
description: Operate and diagnose Native Agent Host runtime roles non-interactively.
cli_version: "0.0.0-dev"
schema_version: 1
---
# Native Agent Host operator

Inspect configuration before starting a role. Prefer structured output:
`native-agent-host --json doctor --component gateway`. Never infer readiness from
process liveness alone.
