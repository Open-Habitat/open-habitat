# ADR 0015: Use highlight.js for browser code blocks

**Status:** Proposed — Jari has not approved this dependency.

**Date:** 2026-10-14

## Context

Answers and tool output can contain growing, partially streamed code blocks. Code and file cards need highlighting for plain text, Python, Rust, JSON, YAML, shell, Markdown, TypeScript, JavaScript, Go, HTML, CSS, TOML and diffs. The browser is a static React/Vite app, must load no runtime CDN assets, and already marks changed words and lines in file-card diffs. Syntax colors must follow the product's light and dark design tokens, without replacing the semantic diff colors.

A disposable spike compared Shiki 3.20.0 (core, JavaScript regex engine, CSS-variable theme, individually imported grammars), highlight.js 11.11.1 (core plus individually registered languages), and Prism 1.30.0 (core plus components). Each used a minified esbuild 0.25.12 browser ESM build with splitting and per-language dynamic imports; gzip level 9 was applied to each output chunk. Sizes below are the sum of the independently gzipped chunks actually reachable from the entry, not npm package sizes; they exclude React, UI integration, CSS, HTML parsing and Vite's own runtime. Plain text needs no grammar. For the issue's TOML requirement, highlight.js has **no TOML grammar**: its INI grammar is the measured approximation; HTML uses its XML grammar. Prism's markup grammar is measured for HTML; shell uses Bash in all three. JS/TS and HTML may share grammar chunks, so summing individual marginal sizes overcounts the total.

| Candidate | Initial core + theme/engine (gzip) | All 13 grammar imports reachable (gzip, including initial) | Lazy loading / language fit | Token-driven light/dark theming | Untagged fence |
|---|---:|---:|---|---|---|
| Shiki | 55.3 kB | 144.4 kB | Per-grammar imports; actual TOML and TextMate scopes, richer language fidelity | `createCssVariablesTheme()` emits `var(--shiki-…)` token colors, mapped to product tokens in CSS | No reliable auto-detection; render plain text |
| highlight.js | 9.1 kB | 28.2 kB | Per-language registration; INI approximation for TOML, XML for HTML | `.hljs-*` classes mapped to product token variables in both modes | `highlightAuto()` over a deliberately small registered subset |
| Prism | 7.9 kB | 21.9 kB | Per-component imports; TOML and markup grammars; some grammars depend on earlier-loaded components | `.token.*` classes mapped to token variables | No built-in detection; render plain text or add another detector |

Warm Node 22.23.2 spike: re-highlight an entire Python block containing repeated function/return/f-string lines, after three warm-ups, 15 iterations per size; median wall time in ms (not a browser frame-time guarantee):

| Candidate | 2 KiB | 16 KiB | 64 KiB |
|---|---:|---:|---:|
| Shiki | 1.86 | 13.27 | 51.23 |
| highlight.js | 1.09 | 3.48 | 14.14 |
| Prism | 0.46 | 0.98 | 4.53 |

The full-block work grows with input size; no candidate makes re-highlighting on every streaming token cheap. Shiki's measured JS engine is not its Oniguruma/WASM engine, whose payload and cost were not measured. Shiki's CSS-variable theme did emit `var(--shiki-token-keyword)` for `def` in the spike. highlight.js emitted `hljs-keyword`, `hljs-title function_` and `hljs-string` classes for the same Python snippet; its INI grammar recognized basic TOML keys, quoted values and table headings, but this is not TOML parity. Color mappings can use existing token variables and switch with the application's light/dark mode; a screenshot or visual contrast test is still needed in implementation. This spike did not measure browser scheduling, grammar-load latency, pathological inputs, or the cost of rendering spans in React.

CodeMirror/Lezer is a credible choice for an *editor* with incremental parsing and maintained syntax trees. This surface is read-only, often short and streamed; taking on editor language packages and adapters just for display is not justified by this spike. No CodeMirror bundle number is claimed because it was not built in the three-candidate comparison.

## Proposed decision

Use **highlight.js core with explicit per-language imports**, loaded only when a visible block needs one. Its 28.2 kB total measured language set is much smaller than the Shiki configuration, supports opt-in detection for unlabelled fences, and is fast enough for bounded, debounced re-highlighting of ordinary blocks. Choose its quality/size balance over Prism's lower byte and CPU cost because the issue explicitly asks for untagged-fence handling and we do not want a second detector. If TOML fidelity is more important than detection, choose Prism instead; Jari should settle that trade-off before implementation.

An explicit, recognized fence takes precedence over detection. For untagged fences, wait until the block is complete and nontrivial, then run `highlightAuto` over a small loaded subset, with a conservative confidence threshold; otherwise leave it as escaped plain text. Never auto-detect every streamed fragment or every installed grammar. For a TOML tag, either use the INI fallback with a documented limitation or leave it plain text if syntax is misleading; do not label this as full TOML support. Unknown, huge or malformed code stays legible as plain text. Text and parsed code must remain inert: do not mount highlighter HTML as unsanitized `innerHTML`. Only permit text and known token classes (or convert a parsed result into React text/span nodes under an allowlist), while keeping the original source for copy and accessibility.

## Consequences and implementation outline

- A later implementation issue should wire code-block rendering to on-demand, locally bundled grammars with a stable alias map for the issue's languages; no network fetch or CDN at runtime. Check the production Vite build for chunk paths and CSP compliance.
- Throttle updates for partial blocks, skip syntax work when a block is collapsed or offscreen, and bound input size. Benchmark real browser frames and adjust the threshold/debounce if scrolling or typing regresses. Highlight on completion with the declared language; reserve detection for complete untagged fences.
- Apply scoped token classes to the *code text inside* file cards, leaving add/delete backgrounds, word-level diff emphasis and accessible diff text as the outer presentation. Test both themes for legibility and contrast, plus language aliases, HTML escaping, partial fences, unknown languages, streaming and long blocks.
- highlight.js is BSD-3-Clause; Shiki and Prism are MIT. All three are maintained third-party packages as of this comparison, but the dependency and registered grammars still need normal version/security updates. The extra parsed spans and grammar chunks cost memory; the INI-for-TOML approximation is a known quality compromise.

Only this ADR is proposed; implementation is not authorized or filed until Jari approves the dependency. [Selection issue](../../issues/choose-syntax-highlighter/item.md).
