---
created: 2026-10-14
updated: 2026-10-14
type: feature
reporter: jari
status: in-progress
priority: normal
related: ['@choose-syntax-highlighter']
lane: web
lane_seq: 30
collision: [web/]
---

# Highlight code blocks with highlight.js

Implement ADR 0015 (`docs/decisions/adr-0015-browser-code-highlighting.md`, accepted by Jari 2026-10-14): use highlight.js core with explicit per-language imports for code blocks in answers, output boxes and file cards. The ADR's "Decision" and "Consequences and implementation outline" sections are the specification.

## Acceptance Criteria

- [ ] Languages: plain text, python, rust, json, yaml, shell/bash, markdown, typescript/javascript, go, html (xml), css, toml (via ini, documented as a limitation) and diff, with a stable alias map. Grammars are bundled locally and lazy-loaded, with no runtime network access (production Vite build and CSP checked).
- [ ] Token colours come from design tokens in light and dark themes, with contrast checked. File-card diff backgrounds and word-level emphasis remain the outer presentation.
- [ ] Streaming blocks re-highlight throttled. Collapsed or offscreen blocks are not highlighted. Large blocks are bounded. Untagged fences are detected only when complete, with a confidence threshold.
- [ ] No unsanitized `innerHTML`. Copy and accessibility use the original source.
- [ ] Tests: Vitest for aliases, escaping, partial fences, unknown languages; lab screenshots for both themes.
