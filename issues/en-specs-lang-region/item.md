---
created: 2026-10-31
updated: 2026-10-31
type: bug
reporter: conductor
status: fixed
priority: high
lane: en-specs-lang-region
lane_seq: 1
preparation: ready
closed: 2026-10-31
---

# English browser specs expect lang=en after the en-US/en-GB split

The clean gate on main `5ee2bb79` failed five English browser specs after
`language-en-us-gb`: each asserts `html[lang="en"]` while its context's
locale is `en-GB`, and the product now correctly sets `lang="en-GB"`.
Everything else passed (ordinary 519, lab 161, Go, contracts, packaging).

- `composer-english.spec.ts:31`
- `en-shell-editor.spec.ts:32` and `:94`
- `worker-panel.spec.ts:332` (in English)
- `lab-en-workspaces.spec.ts:25`

Update the expectations to the regional tag the context's locale resolves
to, and grep the other English specs for the same plain `"en"` assertion.
Gate log: `~/.local/state/oh-conductor/gate-r43/stdout.json` on Birch.
