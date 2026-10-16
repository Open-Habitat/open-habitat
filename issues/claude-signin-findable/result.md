# Claude sign-in discoverability

## Cause and fix

The starting production component (`31836307`) always rendered Claude sign-in under **Agentit → Pi**, independently of administrator status or runtime availability. Runtime facts disable the action, not hide the row. There is no feature flag controlling it. The accepted settings round `2026-10-15-asetukset`, direction 2 **Osiot**, instead places native sign-ins and API keys in **Yhteydet**. Claude had been added to a different section from ChatGPT, GitHub and the API key. This is the confirmed navigation/design mismatch; no claim is made that a live runtime fault has been reproduced.

Moved the existing sign-in component to **Asetukset → Yhteydet → Claude (Pi)** without changing credential handling, leases, provider selection or daemon authority. Agentit retains model/work preferences and now has an explicit **Hallitse kirjautumisia** shortcut to Yhteydet, preserving findability for someone following the previous instructions. The section heading receives keyboard focus through the existing navigation effect. KOKEILTAVAA now names the actual primary path and the shortcut.

The lab also exposed a test blind spot: its host never registered `/api/v1/pi/claude-login`, so the real row showed a failed status read. The previous Claude browser case mocked that entire endpoint. Registered the same daemon handler used by production in the synthetic host; without an installed Claude runtime it now truthfully returns `unavailable`. A browser case exercises that real response, as Bob on a phone, and verifies the visible reason, disabled action and navigation shortcut. This does not install a runtime or simulate an authenticated subscription.

## Paired visual evidence and deliberate differences

All captures are synthetic; no live host, personal profile or credentials were captured. The issue as received contains **no screenshot attachments**, so a paired comparison against Jari's live screen was not possible. The independent reference is the accepted round, captured as `visual/prototype-Yhteydet` at 1280×900, direction 2, Yhteydet selected. Static HTML accompanies each image. Prototype fixture identities are invented.

- `before-Yhteydet` / `after-missing`: same desktop viewport and selected section, GitHub and API-key state unknown. Before has no Claude row; after places it beside the other credentials. Compared with `prototype-Yhteydet`, the sectional navigation and credential-card grouping are retained.
- `after-reference-state` / `prototype-Yhteydet`: Yhteydet selected at 1280×900, GitHub connected, native Pi credentials usable, API key absent. Browser-intercepted presence facts align these reference states; the additional unsigned-in Claude row is the intended difference. The existing GitHub disconnect UI remains more verbose and can show its separate failed preflight; it is unchanged by this task.
- `before-Agentit` / `after-Agentit`: same desktop section. The unrelated Claude credentials row no longer precedes model preferences; the explicit shortcut takes its place. The before row's read failure also documents the missing lab route, rather than pretending it was a live runtime observation.
- `after-unavailable`: real synthetic host response, no browser interception. The unavailable reason and disabled button remain visible in Yhteydet.
- `after-missing`, `after-code`, `after-code-phone-dark`: browser-intercepted synthetic Claude states over the lab shell, showing an unsigned-in action and its authorization link/code editor at desktop and phone widths. They are visual review material, not actual Claude authentication evidence.

Intentional deviations from the prototype: Claude was not present in the older round, so its row and code editor are additive requirements from the accepted bridge implementation; the new Agentit shortcut is an explicit discovery aid, not a second credential editor. Existing runtime diagnostic text and native-store explanation remain, even though they make the Claude row taller than the prototype's short signed-in ChatGPT row. Existing production shell/back control, Agentit plural label, model picker, GitHub disconnect confirmation and API-key implementation are unchanged; this task does not redesign those independently implemented components. The prototype's signed-in ChatGPT state is not evidence of a signed-in Claude state. No invented subscription entitlement or credential was introduced to match it.

## Regression evidence and validation

`OH_PORT_BASE=29100`; disk-backed `TMPDIR=/var/tmp/open-habitat-build`; Playwright uses an existing synthetic browser cache, never a personal Chrome profile.

- The extended Claude sign-in browser journey was run against the original Account component: **failed** because Yhteydet had no Claude region (5-second assertion). Restoring the fix makes that assertion and the Agentit shortcut pass; the journey still covers one-time code erasure/submission and provider-qualified native-default selection.
- Fast web checks: formatting, lint, TypeScript, **140 app tests and 133 component tests passed**.
- Initial focused suite: the new phone case incorrectly checked the hidden account menu before opening the drawer; corrected the test to sign in at desktop width, resize and open navigation as the existing phone test does. The native API-key case timed out because this fresh worktree lacked `internal/daemon/pi-device-test/node_modules`; installed its pinned dependencies without lifecycle scripts. No timeout or product behavior was relaxed.

Final focused account-settings suite: **12/12 passed** (16.6 s), including both Claude journeys and the native API-key case after its dependency install. Manually inspected the prototype, both before sections, after Agentit, missing, unavailable and desktop/phone code states: no clipped actions or horizontal overflow; the phone code form is usable in the existing one-column layout. Images were converted to AVIF with a disposable worktree-local Pillow environment. `git diff --check` and `issuectl doctor --json` passed. Full gate and integration results follow below.

## Focused self-review

The production change is confined to Account's section composition and a navigation intent. It neither duplicates the sign-in component nor changes its authorization/cancellation behavior. A mapped non-admin identity can discover it without administrator information or a successful native-runtime probe. Failed probes and unavailable states still render the row. Models remain under Agentit; the existing browser journey returns there explicitly before selecting Claude. The test-only route uses the real daemon handler/trust predicate and remains outside the production binary. No auth, contract, generated file, runtime selector or credential store changed.

Live acceptance remains manual in KOKEILTAVAA: deploy this tree, check the mapped user's actual availability, perform Jari's subscription sign-in and first Claude turn. Synthetic results do not establish live runtime health, provider entitlement, or distinct-UID isolation.
