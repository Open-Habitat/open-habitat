# Result

Goals can opt into `start: immediate`. Complete requests chosen from a workspace, an empty conversation or the first-message worktree view use the ordinary send path once. Placeholder requests and nonblank drafts still prepare and wait; guides and native skill chips are unchanged. Invalid start values are rejected. The authoring skill and generated UI reference describe the option.

Creation must actually begin before a landing queues its request. Opening a model chooser or refusing creation leaves only a prepared draft. The existing held-message command IDs and receipts own delivery; rendering and reconnecting do not enqueue another request.

## Decisions for later review

- Use `start: immediate`, with omission meaning prepare-and-wait. A boolean or a second explicit default value would add vocabulary without changing behavior.
- Explain mode only prepares even immediate goals, preserving the existing no-lasting-effects rule.
- The existing placeholder parser decides whether input is needed; malformed bracket text remains literal, as before.
- Immediate goals in the first-message worktree view use that view's normal Send, including creating the worktree. Treating this empty view differently would silently ignore the authored option.
- If creation needs a model choice or a send is currently refused, retain the prepared request for manual Send rather than leave a latent automatic send for a later visit.

## Verification

- Focused daemon package tests and contracts validation/generated-contract check passed.
- Focused web static, unit and component checks: 215 files, 1,658 tests passed.
- Host-backed synthetic browser specs `lab-start-page-immediate`, `lab-start-page-goal`, and `lab-workspace-landing`: 14 tests passed on each of three final runs, with two workers and reply jitter. Includes synchronous double clicks, reload, ordinary and worktree creation, placeholder and draft fallback, unchanged default goals, guide/chip behavior, and existing accessibility checks.
- Explain card inspected in Finnish and English at 1440 and 390 pixels; paired synthetic PNG/HTML captures retained under `/var/tmp/agent-keep/start-page-immediate/` rather than public git. No UK override differs for this card.
- Independent review: claude-fable-5-2 finder, gpt-6-astra verifier; assessment confirmed two integration gaps (enqueue before creation acceptance; creation view ignoring immediate intent). Both fixed and covered. No follow-up issues.
- UI reference regeneration exposed unrelated pre-existing drift; only this feature's two reference changes are included.

Live check: add `start: immediate` to a goal with a complete prompt, then choose it from the workspace or an empty conversation. It should send once with its guide alongside. Add a placeholder or type a draft first: choosing the goal should instead wait for Send. No live deployment was performed by this worker.
