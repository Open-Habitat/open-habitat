# Result

Added `.pi/skills/explain-card/SKILL.md` and named it in `web/AGENTS.md`.
The skill teaches the calm Finnish/English guide posture, points to the live
card schema and mapping, explains conditional/action fields, and works through
existing Git-state card Y04. It covers catalog checks, UI-reference generation,
and synthetic 1440/390 inspection. No production cards or runtime code changed.

The first acceptance item is checked. The issue is `done` as requested; the
second item deliberately remains unchecked for `helpers-panel-explainer-text`'s
worker to use the skill on the Avustajat cards. That issue was not edited.

## Review

Ran `/llm-skill-review` with `gemini-3.8-flash`, one call each for executor and
design-fidelity, against the draft plus real sources/issue intent. No callee
skills. Applied the supported edits under the brief's authorization to fix
review findings. Focused self-review checked the final wording against the
renderer, parts map, generator and catalog tests.

| Decision | Finding / lens | Evidence and operational impact | Reader cost / convergence | Resolution |
| --- | --- | --- | --- | --- |
| FIX | Lasting-action registration / executor | Draft said “check that it waits”; `waiting.has(id)` actually gates presses. A new ID could otherwise execute. | Shorter clarification; one lens | Explicitly add the new lasting action's ID to `waiting` and verify. |
| FIX | Opening without `try` / executor | Draft referred only to “optional presentation hints”; renderer uses `!!text.try || !!part.opens` for the touch action. | One short sentence; one lens | Name `opens: true` for opening controls without `try`. |
| SKIP | Generator followed by `--check` / design-fidelity polish | Reviewer called the second command redundant, not a design violation. It is harmless verification and clearly separated from visual proof. | Removing saves one line; one lens | Keep the explicit drift check. |

Design-fidelity found no material drift against the issue. No unresolved
findings, new issues, architecture changes or authority changes.

## Validation

Documentation-only scope; checks ran on this worker's final uncommitted changes
before the issue commit (whose parent records the source baseline):

- `issuectl doctor --json`: exit 0, no warnings or schema problems; existing
  inventory contains 435 non-AVIF images, none added here.
- `python3 scripts/validate-project-view.py`: passed, 15 pages / 15 navigation entries.
- `git diff --check`: passed.
- `ls scripts | grep -i skill`: no repository skill-lint script exists.
- Local Python frontmatter check: matching directory/name, legal name, and
  nonempty description within the skill specification limits passed.

No npm, Go or browser tests were needed or run for these instruction-only
changes. No regeneration was needed: the generator consumes browser source,
which is unchanged. Visual evidence and first-use validation belong to the
Avustajat-card worker; this result does not claim them.

## Decisions for later review

No new product decisions. Selected Y04 as the worked example rather than a
worker card because it compactly demonstrates visible marks, destination and
safe action without pre-writing the dependent issue's cards.
