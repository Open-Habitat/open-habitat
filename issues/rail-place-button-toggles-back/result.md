# Result

Tuotokset and Agentin käytössä now open over the current workspace or conversation. Pressing the same rail link again returns to that view without remounting it: draft, reading position and an unsaved editor buffer remain. Switching between these places keeps the original return destination. The feature is not experimental-gated.

Resource sources/folders and output filters retain the return route. Pending conversation creation cannot dismiss a place; archive undo returns to the restored conversation. The phone menu remains reachable, including after narrowing a window with an editor underneath. Settings can cover a place without changing its return destination. The keyboard skip link moves focus without discarding route state.

## Decisions for later review

- **Home stays navigation**, not a toggle. Unlike the two utility views, it is the stable workspace-list destination. Its existing design explicitly describes it that way.
- **Browser history remains ordinary navigation.** Opening a place pushes an entry; switching places or their internal filters/folders replaces that entry. Back closes a normal visit and Forward reopens it. Explicit toggle/Escape replaces the entry with the captured return location rather than blindly going Back, which could reopen an intermediate Settings page. This can leave consecutive identical background entries; that is preferable to depending on private browser-history indexes or reopening Settings. A restored context view no longer assumes its close action can blindly go Back.
- **A direct link with no background closes to the workspace list.** No new last-conversation registry or persisted history is introduced. Modified-click/new-tab behavior remains ordinary link behavior.
- **Escape closes the place outside fields**, matching Settings' keyboard posture. Composing input, modifiers, menus, dialogs, listboxes, editors and terminal surfaces keep their own keys. Opening focuses the stable place container even while data loads; closing restores the relevant rail link.
- **Use `aria-current="page"`, not `aria-pressed`.** These remain navigable links with real URLs, not button-role controls; the active place keeps the existing selected surface.
- **Oma selain keeps its existing modal model.** Rebased onto the concurrent row implementation (`27abff3a`) and preserved it. Its X/Escape already returns to the underlying view; its rail row is inaccessible while the modal is open. Converting that viewer into a nonmodal place would be a separate layout change, so no unreachable repeat-click behavior was added.

## Verification

Tested implementation: `31170296634fa3cac00e1b137978c98afc9dfed7`, tree `efce40f17975aa358d8044755f0b547916ad0fdb`, based on the integrated browser-row work. Later result/issue-only commits do not change these inputs.

All commands used `umask 077`, bounded timeouts, the scratch lease, and two browser workers with a separate port base. Synthetic host-backed Chromium evidence only:

- `./scripts/test-focused.sh --area web`: **251 files, 2043 tests passed**, including lint and TypeScript checks.
- From `web/`, `npx playwright test tests/rail-place-toggle.spec.ts tests/agent-resources.spec.ts tests/settings-close.spec.ts tests/browser-editor.spec.ts --repeat-each 3`: **144 passed** with 0–60 ms reply jitter. Covers same DOM instance, draft/scroll, Back/Forward, direct links, Home, Settings, source/folder changes, dirty editor/no writes, skip link, phone/resizing, context close, archive undo, pending creation and expired-session sign-in.
- `./scripts/test-focused.sh --area browser --spec view-links.spec.ts --spec server-browser.spec.ts --spec lab-rail-keyboard-help.spec.ts`: **16 ordinary + 4 lab tests passed**. Includes affected accessibility checks and the integrated server-browser navigation.
- `OH_VISUAL_CAPTURE=1 ./scripts/test-focused.sh --area browser --spec rail-place-toggle.spec.ts`: **5 passed**. Inspected desktop outputs and phone resources screenshots; matching synthetic HTML and final logs are in `/var/tmp/agent-keep/rail-place-button-toggles-back/`.
- `git diff --check`, issue doctor and project-view validation: passed.

An earlier extra view-links run timed out on an untouched file-offer hover control before entering a place. The same-seed retry and subsequent complete selected run passed; no claim of a main-branch reproduction is made. Initial implementation checks also caught loading-focus and phone-toolbar defects; both were repaired before the final runs.

## Review

Focused self-review plus independent `/llm-review` and `/assess-findings`: finder `claude-fable-5-2`, verifier `gpt-6-astra`, two calls. Seven source-confirmed navigation/lifetime defects were fixed, including the native skip-link dirty-buffer loss; regression cases exercise every fix. No unresolved findings or follow-up issues. Reports and assessment JSON are retained beside the synthetic evidence. Model-corpus publication was intentionally disabled under this worker's no-push instruction.

No daemon sessions, contracts, authority or native browser input behavior changed. No full browser suite, clean gate, live deployment or non-Chromium verification was run; those are not claimed.

## Live check

After deployment, leave an unsent draft and scroll upward in a conversation. Open Tuotokset, switch to Agentin käytössä, browse a source, and press its rail link again: the same draft and reading position should return. Repeat from a workspace page, with an unsaved editor document and from the phone menu. Check Escape outside a field, Back/Forward, and an ordinary Home click. Open Oma selain and close its modal with X/Escape. Live deployment remains the conductor's step.
