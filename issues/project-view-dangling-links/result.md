# Result

Fixed all 16 dangling Markdown links. The home-page reference now points to the living navigation draft; missing design notes, prototype evidence and the screenshot are explicitly historical references, not links to absent files. Current design guidance and ADR 0031 remain linked where relevant.

Verified:
- `python3 scripts/validate-project-view.py` — passes (13 pages).
- `python3 scripts/test-project-scripts.py` — passes (3 tests).
- `git diff --check` — passes.
- Self-review: no missing files recreated, validator unchanged, issue scope and design decisions preserved.

The full clean CI gate was not rerun; this change addresses its reported project-view failure.
