# ADR 0016: Native harnesses, subject to subscription authorization

**Status:** Proposed — awaiting Jari's decision; no subscription integration authorized.

**Date:** 2026-10-15

## Context

The browser currently controls Pi under each person's Unix account. Jari wants Claude through a Claude subscription and is considering a Pi extension or running Claude Code and Codex next to Pi. The [research and primary-source excerpts](../../issues/claude-subscription-path/analysis.md) show that `pi-claude-code-ui` is only a Pi display extension. Anthropic explicitly disallows third-party products from offering claude.ai login or subscription limits via the Agent SDK without prior approval. Its documentation does not grant a CLI wrapper around this hosted product an exemption. OpenAI's Codex app-server documentation likewise says its authentication has not been permitted for hosted or commercial services, and directs those products to Sign in with ChatGPT and a partner route. Technical login capability does not confer usage rights.

[ADR 0001](adr-0001-unix-native-agent-host.md) makes native histories and credentials the sources of truth; [ADR 0010](adr-0010-taskfleet-worktree-agents.md) assigns browser Pi ownership to the user's daemon, not Taskfleet.

## Proposed decision

Add non-Pi agents as **separate native harnesses**, rather than run Claude Code inside a Pi extension. Each person's daemon would own browser-started native Claude Code or Codex processes under that person's Unix account; the harness would own credentials, settings and history. The gateway would continue to map only the browser identity to the Unix account. Browser events and controls would be translated by per-harness adapters with explicit capabilities and one-writer/continuation checks. Taskfleet would continue to own worktree runs; no parallel conversation or credential store would be introduced.

**Provider authorization is a prerequisite to subscription support, not an implementation detail.** Do not expose Anthropic claude.ai login or subscription limits in this hosted product without Anthropic's explicit approval for this use, including the CLI-vs-SDK distinction. Do not extend Codex app-server subscription authentication to the hosted product on the strength of its local sign-in documentation; obtain OpenAI's applicable Sign in with ChatGPT/partner authorization and review the existing Pi/Codex OAuth path with OpenAI. API-key billing is a separate commercial route to evaluate, not a substitute description for a subscription.

## Consequences and alternatives

Native harnesses preserve the same history, configuration and credentials for SSH and browser use, at the cost of separate controllers, native history readers, capability-aware contract changes and testing against upstream releases. The current `pi:<uuid>` browser ID and Pi-specific command/onboarding types cannot be silently relabeled as generic. Live steering in Claude Code and safe continuation of both harnesses require validation, not assumption.

A Pi extension invoking the Claude Agent SDK could share Pi's browser controller but would layer one agent loop and history on another and is explicitly blocked for subscription login without prior approval. Direct Claude API calls from Pi could be permissible with commercial API billing, but would not deliver subscription use and would make Pi rather than Claude Code own the conversation. A native CLI wrapper is a better architectural fit, **not** proof of subscription permission.

This record is a proposal only; architecture and any provider approval remain for Jari to decide.
