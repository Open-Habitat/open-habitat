# Result

Fixed the formatting rejection and later-turn recovery paths in the automatic titler. No authority boundary, contract, UI control or persisted metadata was added.

## Diagnosis

The original pilot response cannot be reconstructed: provider output is intentionally not logged. `model_invalid_response` previously meant either an oversized/malformed helper envelope, missing model/title, invalid/control-bearing title, non-JSON model text (even a reasonable plain title), empty/thinking-only text, token-limit stop, or a phrase outside the strict 2–5 words / 32 characters rule after rewrite/fallback. Quoted text inside JSON could previously pass with visible quotes; plain quoted text failed because its parsed value was not an object. Multiline strings were rejected. Refusals usually failed JSON parsing, rather than being specifically recognized.

First-attempt failure latched `automaticFirst` but left `automaticName` empty. Third-turn refinement required that name, so no later automatic attempt was possible. The snapshot could still display the first-message fallback, but no generated native name was written.

## Changes

Normalize plain text, JSON strings/objects, fenced JSON, surrounding quotes/bold markers, Title/Otsikko labels, whitespace and the first line. Accept single-word and six-word topics. Preserve the complete rewrite and fallback path; only then cap a remaining long candidate at a Unicode boundary, preferably a word boundary, with an ellipsis. Still refuse empty output, reasoning-only output, partial token-limited output, malformed JSON debris, punctuation-only text, controls/bidi controls and common refusal/preamble shapes. Semantic garbage in arbitrary languages cannot be ruled out syntactically.

One later settled turn retries a failed automatic model generation. It uses the original topic plus latest message, remains bounded to one retry, and consumes refinement when it already includes third-turn context. Native-name checks and explicit rename precedence remain unchanged. Read/write failures are not blindly retried.

## Decisions for later review

- Retry once on a later settled turn instead of persisting the first-message fallback. This gives the model more context and a chance to recover without inventing a title store or replacing a chosen name. If both attempts fail, the existing display fallback and manual regeneration remain; retries are per live handle, not persisted across daemon restarts.
- Preserve complete rewrite/fallback preference; allow ellipsis capping only as last resort, as this brief requests. Alternative: reject every overlong candidate (the earlier behavior), which recreates unnecessary invalid-response failures. One-word topics are valid, including languages without space-separated words. The prompt still asks for concise complete phrases.
- Keep logs content-free. A real pilot payload cannot be recovered from a fixed failure code, and adding private response text to diagnostics is not justified.

## Evidence and review

Base: fb1c9c0dbff9c15eb8b836eeb550e42b0380f9da plus this issue's diff.

- Installed locked web and Pi SDK fixture dependencies.
- `./scripts/test-focused.sh --area web`: passed, 193 files / 1448 tests.
- `./scripts/test-focused.sh --area browser --spec title-regeneration.spec.ts`: 3 passed, synthetic host, OH_PORT_BASE=18600, workers=2. No browser specs changed and no whole suite run.
- `go test -race ./internal/daemon -run 'TestTitle|TestGeneratedTitle' -count=1`: passed after normalization/retry fixes. Subsequent test-only addition verifies real SDK reasoning_content-only output is rejected.
- Final `go test ./internal/daemon -skip '^TestAgentCommandPathIsPerHomeAndInherited$' -count=1`: passed (232.8 seconds), including that reasoning-only fixture. All Go runs used umask 077 and disk-backed scratch.
- Full focused daemon package was run twice. First exposed missing Python referencing (installed in private uv venv); second had only the known PATH fixture failure. Reproduced the same failure on main 5e59b17bcda2232a6e278ccd34b482337e625472. Already filed as `agent-path-test-misses-core-tools`; no duplicate filed and no foreign issue edited.
- Focused self-review plus independent claude-fable-5-1 finder, local assessment and gpt-6-astra verifier. Fixed three concrete initial-diff findings: complete fallback losing to capped primary, chatty preambles accepted, duplicate refinement after third-turn retry. Verifier found all three resolved. Scratch review/assessment under history/; durable summary here. No live provider behavior or original pilot response was verified.

Development failures resolved: retry counter initially used int rather than uint64; one whitespace-mismatched edit made no change; two initial test expectations exposed an overbroad first-attempt scheduling change (reverted) and the exact word-boundary cap (corrected). They do not affect final passing evidence.
