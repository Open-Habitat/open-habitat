---
created: 2026-11-10
updated: 2026-11-10
type: feature
reporter: jari
status: done
priority: normal
provenance: other
provenance_detail: Jari 10.11.2026, observed in a research worker
source_ref: conversation:jari-2026-11-10/web-search
lane: web-search
lane_seq: 1
preparation: pending
closed: 2026-11-10
closed_by: conductor
---

# Agents on Pi have no web search; offer a search capability in the runtime

## Description

## Description

Jari 10.11.2026: a Taskfleet research worker (Pi on GPT, the `capable-openai`
profile) in another conversation had no working web search. It fell back to
curl on search engines: DuckDuckGo answered with a block page, Bing returned
unrelated results, and JavaScript pages could not be read. Facts in that
research report were left unverified as a result.

What decides it is the harness and model, not the machine:

- Pi has no web search tool of its own. Neither Birch nor Alder has a search
  extension or a search MCP server in `~/.pi/agent`, so every Pi agent on GPT
  is left with curl, both in Habitat and in Alder's terminal sessions.
- Claude Code workers (for example the `prototype-opus` profile) have built-in
  WebSearch and WebFetch.
- A Pi on the Claude subscription (pi-claude-bridge) can reach WebSearch only
  indirectly, through the bridge's AskClaude delegation in `full` or `read`
  mode.

Why this is a product question: Habitat gives each person's agents their
runtime (core runtime: Pi, Taskfleet, bundled skills). The people on an
installation, customers included, hit the same gap the moment they ask their
agent to look something up. Nothing in Settings › AI offers search today.

Possible directions, still to be designed with Jari (research first, see
AGENTS-WORKFLOW):
a search extension in the core runtime that uses a search API key from
Settings (Brave, Exa, Tavily or similar); the AI provider's own native search,
where the person's subscription includes it (OpenAI Responses `web_search`,
Anthropic server tools), if Pi's providers can pass it through; or a
server-provided key chosen by the administrator, like the existing
server-provided AI key. Reading JavaScript pages is a separate need (a
headless browser tool; the runtime already ships a headless Playwright
profile).

## Decisions

### 2026-11-10T07:15:41Z · @jari

Jari 10.11.: start the research step: how Habitat brings web search (and reading JavaScript pages) to the person's agents. Material for a design discussion, not an implementation plan.

### 2026-11-10T13:04:46Z · @jari

Jari 10.11.: the goal is web search in every Open Habitat installation (the product), not a Alder-specific setup.

### 2026-11-10T13:11:59Z · @jari

Jari 10.11. answers to research.md's questions: (1) yes, the gateway may give people an administrator's search key (ADR 0030 copy pattern), a personal key takes precedence; (2) Brave default, Staan as the EU option once its coverage is verified; (3) yes, the subscription's native search is the zero-setup default, and Claude must work too (he does not accept that it fails on the Claude subscription); (4) the headless browser for JavaScript pages for everyone (core runtime); (5) search must also work on Alder; (6) own small extension, built on existing community extensions as the base.

## Resolution

### 2026-11-10T13:11:59Z · @conductor

Research done; Jari's decisions 10.11. carried by web-search-native, web-page-reader, proto-web-search-key, web-search-alder.
