# Browser profile (warm standalone full suite)

Chromium, 8 workers, 142 passing cases, `OH_PORT_BASE=24100`; Playwright JSON reporter: 82.15 s wall. Durations below include fixture setup and execution per case. Parallel cases overlap, so column sums are not gate wall time.

| Spec | Cases | Sum of case time (s) | Slowest case (s) |
| --- | ---: | ---: | ---: |
| `browser-conversation.spec.ts` | 58 | 241.40 | 15.37 |
| `native-history.spec.ts` | 7 | 38.31 | 11.42 |
| `pi-onboarding-host.spec.ts` | 3 | 37.96 | 21.21 |
| `design-system.spec.ts` | 7 | 28.70 | 12.49 |
| `resilience-states.spec.ts` | 9 | 27.68 | 4.49 |
| `account-settings.spec.ts` | 6 | 25.71 | 6.40 |
| `pi-onboarding-slow.spec.ts` | 2 | 20.03 | 15.01 |
| `workspace-slice.spec.ts` | 4 | 17.74 | 5.89 |
| `pi-onboarding-restart.spec.ts` | 2 | 15.63 | 8.71 |
| `workspace-slice-security.spec.ts` | 8 | 15.57 | 4.97 |
| `onboarding-notices.spec.ts` | 3 | 14.20 | 6.29 |
| `first-use-ux.spec.ts` | 3 | 13.63 | 6.30 |
| `shell-accessibility.spec.ts` | 3 | 12.09 | 5.64 |
| `pi-onboarding-race.spec.ts` | 2 | 11.88 | 9.31 |
| `lifecycle-frames.spec.ts` | 1 | 10.62 | 10.62 |
| `github-first-onboarding.spec.ts` | 4 | 10.47 | 4.93 |
| `control-states.spec.ts` | 3 | 9.76 | 7.10 |
| `pi-onboarding-session.spec.ts` | 1 | 8.15 | 8.15 |
| `github-observation.spec.ts` | 3 | 7.74 | 3.24 |
| `pi-onboarding-cancel-race.spec.ts` | 1 | 7.00 | 7.00 |
| `pi-attempt-host.spec.ts` | 1 | 6.20 | 6.20 |
| `github-session.spec.ts` | 1 | 5.30 | 5.30 |
| `theme.spec.ts` | 3 | 4.92 | 2.79 |
| `round4-polish.spec.ts` | 2 | 4.89 | 2.69 |
| `terminal-sync.spec.ts` | 1 | 4.85 | 4.85 |
| `pi-native-route-gate.spec.ts` | 1 | 3.30 | 3.30 |
| `github-stream.spec.ts` | 1 | 2.52 | 2.52 |
| `github-denied.spec.ts` | 1 | 2.50 | 2.50 |
| `github-slow.spec.ts` | 1 | 2.43 | 2.43 |

## Each case

| Spec | Case | Duration (s) |
| --- | --- | ---: |
| `account-settings.spec.ts` | @account-settings verified native state, route return and explicit disconnect | 4.94 |
| `account-settings.spec.ts` | @account-settings partial, unknown and logout/user switch | 6.40 |
| `account-settings.spec.ts` | @account-settings Pi credentials change while the page is open; uncertainty is not success | 4.02 |
| `account-settings.spec.ts` | @account-settings direct settings URL cannot bypass initial Pi gate | 3.61 |
| `account-settings.spec.ts` | @account-settings unavailable snapshot does not display previous identity | 3.68 |
| `account-settings.spec.ts` | @account-settings compact phone drawer and settings preserve status and radio keyboard selection | 3.05 |
| `browser-conversation.spec.ts` | @browser-conversation new controller stays calm and shares settled state with navigation | 4.96 |
| `browser-conversation.spec.ts` | @browser-conversation saved assistant turn exposes bash command and folds work without hiding reply | 4.57 |
| `browser-conversation.spec.ts` | @browser-conversation create, send once, reconnect and old history stays read-only | 4.91 |
| `browser-conversation.spec.ts` | @browser-conversation HTTP fallback permits one send while journal is unavailable | 2.59 |
| `browser-conversation.spec.ts` | @browser-conversation transient status failure retries with healthy journal | 6.58 |
| `browser-conversation.spec.ts` | @browser-conversation validated pending send receipt never reposts | 3.53 |
| `browser-conversation.spec.ts` | @browser-conversation validated accepted send receipt never reposts | 3.18 |
| `browser-conversation.spec.ts` | @browser-conversation validated rejected send receipt never reposts | 3.36 |
| `browser-conversation.spec.ts` | @browser-conversation validated uncertain send receipt never reposts | 3.52 |
| `browser-conversation.spec.ts` | @browser-conversation lost reply looks up matching command without repost | 2.63 |
| `browser-conversation.spec.ts` | @browser-conversation safe question and settled boundary require validated status and native key | 2.59 |
| `browser-conversation.spec.ts` | @browser-conversation answers once, survives reload, and reports stale without retry | 3.29 |
| `browser-conversation.spec.ts` | @browser-conversation unknown question cancels once and a refused answer stays stale | 2.52 |
| `browser-conversation.spec.ts` | @browser-conversation in-flight send remains pending through missing receipt | 2.60 |
| `browser-conversation.spec.ts` | @browser-conversation settled marker needs observed native key | 3.48 |
| `browser-conversation.spec.ts` | @browser-conversation footer and floating latest stay clear at phone width | 2.55 |
| `browser-conversation.spec.ts` | @browser-conversation resized editor keeps actions reachable | 2.23 |
| `browser-conversation.spec.ts` | @browser-conversation missing daemon control opens surviving native history | 3.04 |
| `browser-conversation.spec.ts` | @browser-conversation lost create acknowledgement blocks duplicate creation | 3.23 |
| `browser-conversation.spec.ts` | @browser-conversation uncertain send survives reload without duplicate | 3.91 |
| `browser-conversation.spec.ts` | @browser-conversation malformed host status fails closed without rendering HTML | 2.65 |
| `browser-conversation.spec.ts` | @browser-conversation settings checks Pi once; returning and foreground clicks do not revalidate | 2.53 |
| `browser-conversation.spec.ts` | @browser-conversation steer, follow-up and clear return only removed texts | 3.81 |
| `browser-conversation.spec.ts` | @browser-conversation a stale working view cannot strand an unsent queued draft | 15.37 |
| `browser-conversation.spec.ts` | @browser-conversation warm controlled return reads neither status nor history | 3.57 |
| `browser-conversation.spec.ts` | @browser-conversation separate streaming drafts survive agent switches and vanish on identity change | 5.77 |
| `browser-conversation.spec.ts` | @browser-conversation logout fences a pending status read and turn even when server logout fails | 5.02 |
| `browser-conversation.spec.ts` | @browser-conversation a late create reply cannot restore a cleared command marker | 3.93 |
| `browser-conversation.spec.ts` | @browser-conversation expiry clears drafts and pending markers before same-person sign-in | 4.30 |
| `browser-conversation.spec.ts` | @browser-conversation expiry across reload clears unknown prior person's drafts | 4.38 |
| `browser-conversation.spec.ts` | @browser-conversation missing archive history never appears as a confirmed empty archive | 3.52 |
| `browser-conversation.spec.ts` | @browser-conversation archive restores visibility before native continuation | 7.26 |
| `browser-conversation.spec.ts` | @browser-conversation ordinary refresh keeps an explicit continuation proof | 4.82 |
| `browser-conversation.spec.ts` | @browser-conversation an opening continuation proof retries after HTTP failure | 6.45 |
| `browser-conversation.spec.ts` | @browser-conversation uncertain native file writer_present cannot continue | 3.48 |
| `browser-conversation.spec.ts` | @browser-conversation uncertain native file read_only_history cannot continue | 3.17 |
| `browser-conversation.spec.ts` | @browser-conversation uncertain native file unproven cannot continue | 3.27 |
| `browser-conversation.spec.ts` | @browser-conversation ended browser conversation continues explicitly without reposting | 5.97 |
| `browser-conversation.spec.ts` | @browser-conversation continuation writer_conflict never reposts | 5.88 |
| `browser-conversation.spec.ts` | @browser-conversation continuation read_only_history never reposts | 5.81 |
| `browser-conversation.spec.ts` | @browser-conversation continuation control_uncertain never reposts | 6.09 |
| `browser-conversation.spec.ts` | @browser-conversation continuation capacity_exceeded never reposts | 6.17 |
| `browser-conversation.spec.ts` | @browser-conversation lost continuation reply reconciles status and history without another POST | 5.39 |
| `browser-conversation.spec.ts` | @browser-conversation status reconciles before a late continuation reply | 5.24 |
| `browser-conversation.spec.ts` | @browser-conversation stale recovery during continuation never strands controls or reposts | 5.41 |
| `browser-conversation.spec.ts` | @browser-conversation model authentication error offers sign-in without leaking provider text | 7.66 |
| `browser-conversation.spec.ts` | @browser-conversation cold open waits for status before reading history | 2.30 |
| `browser-conversation.spec.ts` | @browser-conversation idle tab and return do not reread session or status | 3.16 |
| `browser-conversation.spec.ts` | @browser-conversation snapshot transport failure leaves editor mounted and retry works | 2.40 |
| `browser-conversation.spec.ts` | @browser-conversation 401 from actual status request opens login | 2.19 |
| `browser-conversation.spec.ts` | @browser-conversation changed snapshot identity discards late previous status | 4.26 |
| `browser-conversation.spec.ts` | @browser-conversation a lost accepted send resolves on reload without another write | 3.52 |
| `browser-conversation.spec.ts` | @browser-conversation queue-clear 401 reaches login | 2.79 |
| `browser-conversation.spec.ts` | @browser-conversation cursor 409 waits for a newer snapshot before reopening | 2.85 |
| `browser-conversation.spec.ts` | @browser-conversation lost accepted reply recovers on HTTP snapshot without an event | 3.06 |
| `browser-conversation.spec.ts` | @browser-conversation a receipt lost on daemon restart remains unknown | 2.72 |
| `browser-conversation.spec.ts` | @browser-conversation daemon restart loses controller without declaring the send rejected | 2.34 |
| `browser-conversation.spec.ts` | @browser-conversation queued command with pending ack stays pending without a receipt | 3.60 |
| `control-states.spec.ts` | production controls are constructed only in ControlElements | 0.04 |
| `control-states.spec.ts` | @control-states shared feedback on navigation, list, button and menu in both themes | 7.10 |
| `control-states.spec.ts` | @control-states migrated rail, drawer and text links retain their layout | 2.63 |
| `design-system.spec.ts` | @visual design catalog happy state in light | 2.74 |
| `design-system.spec.ts` | @visual design catalog happy state in dark | 3.00 |
| `design-system.spec.ts` | @visual unhappy states remain explicit | 3.03 |
| `design-system.spec.ts` | @visual keyboard focus follows visible controls | 2.89 |
| `design-system.spec.ts` | @visual 200 percent zoom has no page-level horizontal overflow | 2.03 |
| `design-system.spec.ts` | @visual reduced motion removes running animation without hiding status | 2.51 |
| `design-system.spec.ts` | @a11y design catalog themes and unhappy state have no axe violations | 12.49 |
| `first-use-ux.spec.ts` | @first-use abort is a danger action on both onboarding steps; first chooser click advances after focus | 2.21 |
| `first-use-ux.spec.ts` | @first-use code preparation never flashes a failure, while a rejected start stays visible | 5.12 |
| `first-use-ux.spec.ts` | @first-use a slow status read does not delay the device-code start, and completion is noticed promptly | 6.30 |
| `github-denied.spec.ts` | @github-first denied write stays uncertain until explicit read-only recheck | 2.50 |
| `github-first-onboarding.spec.ts` | @github-first native synthetic checkout before Pi, complete catalog and existing checkout | 4.93 |
| `github-first-onboarding.spec.ts` | @github-first narrow catalog keeps count and action reachable by keyboard after scrolling | 2.19 |
| `github-first-onboarding.spec.ts` | @github-first empty selection goes directly to Pi | 1.59 |
| `github-first-onboarding.spec.ts` | @github-first incomplete catalog never permits selection or checkout | 1.76 |
| `github-observation.spec.ts` | @github-first existing checkout advances without duplicate POST | 1.96 |
| `github-observation.spec.ts` | @github-first conflict and partial do not invent confirmation | 3.24 |
| `github-observation.spec.ts` | @github-first lost response reconciles by read without another POST | 2.54 |
| `github-session.spec.ts` | @github-first logout and new cookie erase in-flight catalog | 5.30 |
| `github-slow.spec.ts` | @github-first slow reply and focus never start another checkout | 2.43 |
| `github-stream.spec.ts` | @github-first synthetic slow native clone exposes per-repository receiving stage | 2.52 |
| `lifecycle-frames.spec.ts` | @browser-conversation repeated completed turns do not become Pi messages | 10.62 |
| `native-history.spec.ts` | @native-history native page, continuation, unknown, reopen and no writes | 11.42 |
| `native-history.spec.ts` | @native-history empty native session is read-only | 3.77 |
| `native-history.spec.ts` | @native-history mapped identity isolates native content | 3.47 |
| `native-history.spec.ts` | @native-history missing, corrupt and read-only states | 6.81 |
| `native-history.spec.ts` | @native-history narrow history keeps actions visible without page overflow | 3.92 |
| `native-history.spec.ts` | @native-history older page keeps the visible native row anchored | 4.32 |
| `native-history.spec.ts` | @native-history warm return paints from cache while revalidating history | 4.60 |
| `onboarding-notices.spec.ts` | @a11y login error stays aligned with the login card on desktop and phone | 4.91 |
| `onboarding-notices.spec.ts` | @a11y failed session check offers reload under the repository card | 6.29 |
| `onboarding-notices.spec.ts` | catalog notice retries a read, not a clone | 3.00 |
| `pi-attempt-host.spec.ts` | @pi-attempt native reads stay mapped while foreign and stale attempts are denied | 6.20 |
| `pi-native-route-gate.spec.ts` | @pi-onboarding browser checks OpenAI once while direct native reads remain mapped | 3.30 |
| `pi-onboarding-cancel-race.spec.ts` | @pi-onboarding cancel supersedes an in-flight poll | 7.00 |
| `pi-onboarding-host.spec.ts` | @pi-onboarding native attempt drives the production browser, never a callback | 9.72 |
| `pi-onboarding-host.spec.ts` | @pi-onboarding cancel, unknown, expiry and stale session fail closed | 7.03 |
| `pi-onboarding-host.spec.ts` | @pi-onboarding code disappearance stays uncertain through polling, focus and a slow read until explicit retry | 21.21 |
| `pi-onboarding-race.spec.ts` | @pi-onboarding delayed old-session response cannot restore code after focus | 9.31 |
| `pi-onboarding-race.spec.ts` | @pi-onboarding does not offer an action before its session is bound | 2.58 |
| `pi-onboarding-restart.spec.ts` | @pi-onboarding daemon restart invalidates old code, status stays authoritative | 6.93 |
| `pi-onboarding-restart.spec.ts` | @pi-onboarding expired lease drops code and offers retry | 8.71 |
| `pi-onboarding-session.spec.ts` | @pi-onboarding switching sessions drops device instructions and native facts | 8.15 |
| `pi-onboarding-slow.spec.ts` | @pi-onboarding slow native reads finish across multiple poll intervals without duplicate writes | 15.01 |
| `pi-onboarding-slow.spec.ts` | @pi-onboarding lost write reply is uncertain and read-only recheck recovers | 5.02 |
| `resilience-states.spec.ts` | @resilience failed reads recover in place without claiming an empty catalog | 3.18 |
| `resilience-states.spec.ts` | @resilience native discovery error retains previously verified content | 2.61 |
| `resilience-states.spec.ts` | @resilience verified session retains workspaces during a host outage, disables writes and retries | 4.49 |
| `resilience-states.spec.ts` | @resilience expired session reaches login on explicit retry, not tab focus | 2.76 |
| `resilience-states.spec.ts` | @resilience populated native history remains readable during outage | 3.07 |
| `resilience-states.spec.ts` | @resilience active conversation stays readable and blocks writes during snapshot outage | 3.34 |
| `resilience-states.spec.ts` | @resilience restored network retries a failed read without resending work | 2.38 |
| `resilience-states.spec.ts` | @resilience an incomplete catalog does not claim a deep-linked conversation was deleted | 3.13 |
| `resilience-states.spec.ts` | @resilience missing and partial observations can be refreshed without a reload | 2.72 |
| `round4-polish.spec.ts` | @workspace-slice home labels history honestly and route focus keeps keyboard ring | 2.69 |
| `round4-polish.spec.ts` | @first-use pending code keeps attempt cancellation separate from sign-out | 2.20 |
| `shell-accessibility.spec.ts` | @a11y keyboard navigation places focus on destination and restores account menu focus | 2.44 |
| `shell-accessibility.spec.ts` | @a11y signed-out, shell, settings and narrow shell have no axe violations or horizontal overflow | 5.64 |
| `shell-accessibility.spec.ts` | @a11y first-use steps focus their heading and announce chooser count | 4.01 |
| `terminal-sync.spec.ts` | @native-history terminal append reaches two browser contexts once without reload | 4.85 |
| `theme.spec.ts` | production theme follows the system, persists an explicit device choice, and responds live | 2.79 |
| `theme.spec.ts` | theme is applied before the application bundle executes | 0.16 |
| `theme.spec.ts` | theme remains usable if localStorage is denied | 1.97 |
| `workspace-slice-security.spec.ts` | @workspace-slice production bundle contains no fixture controls | 0.80 |
| `workspace-slice-security.spec.ts` | @workspace-slice production UI carries noindex signals without granting API access | 0.04 |
| `workspace-slice-security.spec.ts` | @workspace-slice unknown mapping is denied before session | 1.44 |
| `workspace-slice-security.spec.ts` | @workspace-slice missing GitHub email can be supplied without changing the person | 1.81 |
| `workspace-slice-security.spec.ts` | @workspace-slice account presentation follows the signed-in person | 2.98 |
| `workspace-slice-security.spec.ts` | @workspace-slice untrusted auth error stays generic and retryable | 0.89 |
| `workspace-slice-security.spec.ts` | @workspace-slice callback errors never claim a session and preserve safe deep links | 2.63 |
| `workspace-slice-security.spec.ts` | @workspace-slice browser retains workspaces past 512 and accepts a large partial snapshot | 4.97 |
| `workspace-slice.spec.ts` | @workspace-slice login, routed details, filtering, refresh, focus and logout | 3.24 |
| `workspace-slice.spec.ts` | @workspace-slice confirmed empty, missing, failure, partial and deep link truth | 4.39 |
| `workspace-slice.spec.ts` | @workspace-slice identity isolation, forged headers, expiry and loading | 4.22 |
| `workspace-slice.spec.ts` | @workspace-slice @a11y built host: zoom, accessible states, no serious axe | 5.89 |
