---
created: 2026-09-18
updated: 2026-09-18
type: task
reporter: jari
status: done
priority: high
epic: native-agent-host-architecture
lane: unlaned
closed: 2026-09-18
---

# Map Pi extension surfaces to AHP

## Goal

Determine exactly how Pi extensions expose and receive custom commands, tools, events, UI requests, and other interactions, and assess whether standard AHP 0.9.0 can transport each surface without loss.

## Sources and method

- Inspect the installed Pi package, version, complete extension/SDK/RPC/session documentation, relevant source, and examples under `/home/maintainer/.local/lib/node_modules/@earendil-works/pi-coding-agent/`. Follow all relevant Markdown cross-references before concluding.
- Inspect representative installed/local Pi extensions without modifying them, and distinguish built-in Pi behavior from extension behavior.
- Inspect the authoritative AHP 0.9.0 specification/types and the current `Qusic/pi-ahp` implementation at recorded revisions.
- Where safe, use a disposable extension/config/session to observe actual Pi behavior in interactive, SDK, or RPC modes. Do not modify the user's installed Pi, extensions, configuration, sessions, or skills.

## Questions

- How are extension commands registered, discovered, invoked, and supplied arguments/context?
- Are slash/custom commands sent to the model as text, intercepted before model input, invoked through an RPC command, or handled differently by mode?
- How do extension tools, event hooks, custom messages, notifications, dialogs, editors, widgets/renderers, status, resources, and lifecycle hooks cross a non-TUI boundary?
- Which surfaces already have stable Pi SDK/RPC representations?
- For each surface, is the correct AHP mapping a standard chat/session/tool/input/terminal/resource operation, client customization/tool, namespaced `x-` method/channel/action, opaque fallback, or a separate API?
- What capability negotiation, reconnect, durability, error, security, and unknown-client behavior would custom mappings require?

## Deliverable

Write an engineer-facing English report to `issues/native-agent-host-architecture/research/pi-extension-ahp-transport.md`. Include an exact source/version inventory, observed invocation flows, a complete surface mapping matrix, concrete representative examples, compatibility gaps, and the smallest recommended AHP extension profile. Clearly distinguish facts, tested observations, inference, and unknowns.

Do not implement the adapter or decide the final protocol.

## Acceptance criteria

- The answer does not assume extension commands are ordinary chat text.
- Command discovery and invocation are traced from external input to extension handler and resulting events/output.
- Every material Pi extension surface is classified against AHP.
- Standard AHP and private `x-` behavior are separated.
- The report identifies any Pi behavior that cannot be represented faithfully or safely.
- The result is suitable input to the architecture synthesis and protocol decision.

## Resolution

### 2026-09-18T12:40:28Z · @issuectl

Completed source-grounded mapping in issues/native-agent-host-architecture/research/pi-extension-ahp-transport.md, including tested command/input interception, AHP classifications, lifecycle/security analysis, and the smallest viable profile.
