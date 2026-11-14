# Result

## Actual defect and reproduction

Before changing production code, ran a host-backed synthetic lab case that opened a conversation, typed `/compact`, then edited `/zzz` with ArrowDown, End, an added character and Backspace, and sent it with Enter. `/compact` had no completion row. `/zzz` remained editable and reached the fake Pi as ordinary text; there was no browser exception. A general composer crash was **not reproduced** on this revision.

The catalog comes from the daemon's `commands_linux.go`: live Pi `get_commands`, or a short-lived helper for workspace discovery. That inventory contains extensions, prompts and skills, not interactive built-ins. `Composer.commandGroups` displayed that inventory; `BrowserAction` existed but had no production supplier. Normal submission resolves skill aliases, then BrowserConversation sends through the conversation controller to Pi's `prompt` RPC. Sending `/compact` as prompt text does not perform compaction.

Checked the installed Pi package's `docs/rpc.md`, `docs/rpc-commands.md`, `dist/core/slash-commands.js` and native prompt handling. RPC has separate compact/new_session/set_model/set_thinking_level operations. Its command reference explicitly excludes interactive built-ins from get_commands and says they do not execute through prompt.

The empty completion list already selected index -1 safely. However, it still consumed ArrowUp/ArrowDown and Tab with nothing actionable. Those keys now retain normal editor/focus behavior; Enter sends unmatched text. Regression tests cover `/zzz`, `/settings` and `/compact` without an action supplier.

## Delivered

- Browser actions appear beside skills/prompts, with Finnish and English descriptions and accurate Run keyboard hints.
- `/compact` invokes the existing compaction controller, not a prompt. Sending `/compact instructions` passes custom instructions. Busy, opening and already-compacting states explain why it cannot run and retain the command.
- `/new` opens the existing new-conversation route for the current workspace, without resetting the old native session or stopping its work.
- Send and completion selection both recognize the actions. Attachments or extra text unsupported by an action are refused rather than discarded. Invalid compaction instructions retain the draft; validation uses the contract's Unicode character limit and the daemon's NUL restriction.
- Explain cards L13/L14 map to their own rows. Compaction waits in Explain mode; new-conversation navigation works there.

## Decisions for later review

1. Offer **compact** and **new** in existing browser conversations, with built-in recognition retained while one opens. Before any conversation exists, the normal first-message composer remains unchanged. Alternative: invent queued control commands or reset a session in place. Chosen: existing actions and ownership, no second queue or session lifecycle.
2. Do not offer **model** or **thinking** for established conversations. Habitat's editable selector is for the first message or unsupported-model recovery; the established-conversation chip is informational. Pi RPC support alone is not an implemented browser action. A new mid-conversation settings flow is outside this fix.
3. Leave out **session/tree/resume/fork/clone**, **name/copy/export/import/share**, **settings/scoped-models**, **login/logout/trust**, **changelog/hotkeys/bug**, **reload/quit**. Some have separate Habitat UI affordances, but their native command semantics are not mapped by this change. No fake terminal dialogs or raw interactive commands are advertised.
4. Unknown/unsupported slash words remain ordinary text, not errors, once the native catalog can be checked. A failed catalog lookup keeps the draft with the existing notice. This preserves extension/prompt/skill handling instead of maintaining a second rejection registry.
5. Browser actions retain their existing immediate-selection semantics, unlike native template/skill insertion. The group, preview and keyboard hints say so. A partial fuzzy match selected with Enter/Tab therefore runs the visibly selected browser action; the reviewer’s proposed insertion-only invariant was not adopted.
6. Built-ins take precedence over a same-named native entry at the start of a message, avoiding duplicate ambiguous rows. Mid-message mentions remain native completions.

## Checks and review

- Focused web gate: lint, typecheck, catalog checks and 217 test files / 1692 tests passed.
- Named browser spec `lab-composer-builtins.spec.ts`: five cases passed on port base 16500 with two workers. Covers cold-opening refusal, successful compaction through the real gateway/daemon to fake Pi, `/zzz` editing/sending, and Explain cards/navigation at 1440/390px in Finnish/US English. No feature switch was enabled for compaction; only Explain mode uses its existing switch.
- Paired synthetic screenshots and offline HTML snapshots accompany this result. Cards fit at both widths; the compaction action was blocked in Explain mode and new navigation worked. UK compact description is supplied separately; card text needs no UK override.
- Focused self-review plus claude-fable-5-2 finder and gpt-6-astra verifier. Fixed two confirmed findings: loading could queue a built-in as prompt text, and invalid instructions could be cleared before rejection. Dropped the insertion-only selection claim. Review/assessment scratch is under `history/`; no residual issue filed.
- UI-reference generation and its check passed. Generated output included substantial unrelated pre-existing drift; restored that disposable regeneration rather than committing it. Release packaging regenerates the reference from source.
- No daemon or contract changes, so no Go/contracts suite. No full browser suite, clean gate, real-provider or live-host check claimed.

Live check: In an existing idle browser conversation, type `/compact`, choose its row or press Enter, and observe compaction. Type `/zzz`, edit it and send normally. `/new` should open a new conversation while retaining the old one. Try `/compact` while the agent is working: the command stays with an explanation.
