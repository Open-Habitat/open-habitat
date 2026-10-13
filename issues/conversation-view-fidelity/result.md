# Conversation view fidelity

Side-by-side with the chosen `design-system/drafts/Agentin vuoro.proto.html` and its `app.*`, `composer.*`, `recap.*` rules:

| Draft | Final production view (paired synthetic-lab PNG and offline HTML) |
| --- | --- |
| 30px dark stop square and 26px raised Ohjaa/Työn jälkeen choices | `lab-{1440,390}-{light,dark}-working.*`: icon stop stays left beneath the editor; compact modes stay right, including a long growing draft. |
| 44px resting editor, grows with text | `-composer.*` and `-working.*`: one line at rest, scrollable long text within the capped composer. |
| Recap matches the conversation's content column; quiet 28px refresh and close | `-recap.*`: recap now shares the editor's **inner** width, not its padded outer width. On the phone the automatic label takes a second line so both icon controls stay on the first. |
| Check + Vastaus valmis, model, copy, time | `-reply-header.*` (fake Pi supplies `fake-pi`), `-reply.*` (seeded history): one check before the label, model before copy; no duplicate success mark. The host's history view model carries no message time, so production cannot display the draft's clock without inventing a timestamp. A model is shown only when actually present in native history. |
| No centred completion receipt | `-bash.*` and `-groups.*`: the turn strip is the single finished-work row; native settlement is still used for capability decisions, not another transcript item. |
| Desktop title and workspace on one line, phone on two | `-header.*`: workspace follows the title in muted mono on desktop and wraps beneath it at 390px, leaving room for mobile toolbar actions. |
| Workspace row without current selection fill | `-header.*` and full `-bash.*`: the conversation row retains selection; parent workspace row has hover only. |

Additional paired captures `-groups.*`, `-failed.*`, `-live.*`, and `-bash.*` cover multiple native work groups, a failed bash tool, an in-flight tool and 53-line output at both widths and themes. All snapshots came from the synthetic lab's fake OAuth/Pi and invented native homes. Native-state honesty remains: unknown processes are not folded under finished work; the already-working queue panel stays (per `conversation-actions-layout` and `recap-above-composer`).

Implementation `4cf8f7c1`. Final checks after production edits: `./scripts/test-web-fast.sh` passed (94 component tests), `npm run test:browser --prefix web` 143/143, `playwright.lab.config.ts` 17/17, `npm run test:component --prefix web` passed, `npm run storybook:test --prefix web` built, `test:visual` 6/6, `test:a11y` 7/7, `TMPDIR=/var/tmp go test ./test/browser-host` compiled, `issuectl doctor --json`, `python3 scripts/validate-project-view.py`, and `git diff --check` passed. An earlier browser run failed two assertions tied to the old duplicate completion row and notice alignment; both were corrected and their focused rerun and subsequent full run passed. The recap-width test exposed a selector precedence mistake; after excluding recap from the generic width rule the lab suite passed. No full clean gate, live host, real Pi/provider or distinct-UID isolation was tested.
