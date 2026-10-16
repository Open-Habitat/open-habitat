# ADR 0016: Claude subscriptions through Pi first

**Status:** Accepted — Jari, 2026-10-16

**Date:** 2026-10-15; clarified on Jari's word of 2026-10-16

## Problem

Jari wants to use Claude through his Claude subscription in the browser, as he
uses native agents today. The [original request](../../issues/claude-subscription-path/item.md)
considered a Pi extension or separate agent harnesses. His
[decision on 16 October](../../issues/proto-agent-harnesses/item.md#decisions)
is to keep only Pi underneath if at all possible: he says the Anthropic
SDK-based Pi extension works in practice.

## Decision

Use **[pi-claude-bridge](https://github.com/elidickinson/pi-claude-bridge)**
for Claude subscription access. Its provider uses Anthropic's TypeScript
Agent SDK (`@anthropic-ai/claude-agent-sdk`) to run Claude Code, reusing the
person's Claude Code subscription login. This keeps Pi as the browser-facing
harness. “Works properly” means technical functioning.

A separate **Claude Code harness is a fallback only if the Pi route does not
work technically**. If adopted, its permission prompts must be shown in the
browser so the person can answer them. Codex is not wanted, probably ever.

Use the **field selector** for the conversation choice. The **+ button opens
the default directly**, with no menu, so starting an ordinary conversation
does not require an extra choice.

**Pi owns the conversation history**; the bridge rebuilds its Claude Code
session mirror from Pi's history when they diverge ([source](https://github.com/elidickinson/pi-claude-bridge/blob/874fa7c2678456336f23b64e784e2057e608d83e/src/index.ts)).
Claude credentials stay in Claude Code's native store (on Linux,
`~/.claude/.credentials.json`, per the research below), under the person's
Unix account. These are native-tool stores, not a parallel host history or
credential store, preserving [ADR 0001](adr-0001-unix-native-agent-host.md).

## Revisit condition

Jari, 2026-10-16: “Näin me mennään, ja jos Anthropic nukettaa sen SDK-bridgen, niin sit katotaan mitä tehdään.” If Anthropic shuts down the SDK bridge, revisit the route then.

## Provider terms: context, not the decision criterion

The [15 October research and primary-source excerpts](../../issues/claude-subscription-path/analysis.md)
record Anthropic's stated restriction on third-party products offering
claude.ai login or subscription limits without prior approval, including
Agent SDK products. OpenAI's app-server documentation states that its
subscription authentication is not permitted for hosted or commercial services.
Jari leaves the providers' terms to his own judgment; they are not a technical
acceptance condition or a provider-approval gate in this decision.
