---
created: 2026-09-22
updated: 2026-09-22
type: task
reporter: jari
status: done
priority: high
epic: native-agent-host-architecture
lane: planning
lane_seq: 15
collision: [docs/]
closed: 2026-09-22
closed_by: agent
---

# Correct MVP integration boundaries

## Goal

Apply Jari's review corrections to the accepted MVP definition and Pi-control conclusions before later UI review preparation.

## Accepted corrections

1. Git repositories require a blocking integration/onboarding step before they may be opened in Native Agent Host. The integration must establish the repository and credential environment needed for agents' ordinary `git pull` and `git push` commands, not merely detect `gh` authentication. Describe the user-facing blocking dialog and honest partial/error states without prematurely choosing its implementation.
2. Worktrees are not a general user-managed Git feature. Every supported worktree is a Taskfleet-created and Taskfleet-managed dedicated agent environment. The v1 UI does not let users manually create, edit, or manage arbitrary worktrees.
3. Clarify the Pi control boundary: attaching RPC to a currently running terminal TUI process is unsupported, but `pi --mode rpc --session <session>` is a valid way to start another runtime. The intended transfer is to terminate the terminal process safely, ensure native history is settled, and then start RPC on the same session. Do not imply that the flag combination itself is unsupported.
4. Structured diff display is required for Pi's supported `edit` tool output. Bash-induced filesystem changes need not produce a diff. Other tools may fall back to their available generic output; do not design a synthetic diff engine.
5. Refine `docs/assumptions.md`: keep genuinely uncertain claims whose failure would change the solution; move or rewrite selected architecture invariants and ordinary implementation test requirements so they are not presented as doubtful hypotheses. Integrate the landed Pi probe evidence for claims it actually resolved, with exact links and honest limits. Do not mark the still-unrun workspace/GitHub lifecycle probe as verified.

## Scope and verification

Update the appropriate durable pages under `docs/`, including `product.md`, `ui.md`, and `assumptions.md` where relevant, plus this issue's `result.md`. Preserve accepted features and avoid choosing production technologies. Do not edit `TODO.md`, implement product code, or close human-review issues.

Run:

```sh
python3 scripts/validate-project-view.py
issuectl doctor --json
git diff --check
```

Record the exact changes, validation, and remaining decisions in `result.md`.
