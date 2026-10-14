# Syntax-highlighter selection — proposed

[ADR 0015](../../docs/decisions/adr-0015-browser-code-highlighting.md) recommends highlight.js core with per-language imports, pending Jari's approval. A disposable spike in `/var/tmp/oh-syntax-spike-01m4wpam2dm282xtbwczned2aw/` compared Shiki, highlight.js and Prism. Its `measure.mjs`, `sizes.jsonl`, `bench.mjs` and `bench.txt` are local, temporary measurement artifacts, not shipped with the product or committed. The ADR preserves the method, numbers and their limits.

**Decision for Jari:** approve highlight.js despite INI being only an approximation for TOML, or prefer Prism if accurate TOML grammar matters more than built-in auto-detection. The implementation issue should be filed via intake after approval; this issue remains open until then. No production UI files, dependencies or design tokens were changed.
