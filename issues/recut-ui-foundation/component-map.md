# V2 foundation component map

This slice changes presentation, not authority. App-owned routing, session binding, polling, drafts, history anchors and command receipts remain unchanged. Production components accept display data and emit intents; no network calls or derived host capabilities move into them.

| Draft element | Production owner and change | Later slice |
| --- | --- | --- |
| App frame, banner | `AppShell`, `ConnectionBanner`: viewport grid and app-level warning, not another conversation warning | shared |
| 296/52 rail, connection, workspace rows | `WorkspaceRail`, `WorkspaceSection`, `AgentNavItem`, `StatusMark`: common width and status primitives; no new navigation authority | sidebar |
| Conversation header, title, facts | `AgentHeader`, `AgentFacts`: shared top-bar template; preserve complete title access and existing toggle pending conversation redesign | conversation |
| Transcript, messages, copy, tools, unknown event | `ConversationFrame`, `ConversationTimeline`, `Message`, `ToolRow`, `UnknownEvent`: scrolling region and content column; copy and unknown payload still available | conversation |
| Composer, queue, uncertain send | `ConversationFrame`, `Composer`, `QueuePanel`, `UncertainCommandCard`: footer region, unchanged send modes and receipt handling | conversation |
| Buttons, marks, glyphs | `Button`, `StatusMark`/`Badge`, new `Icon`: variants independent of ancestor; SVG glyphs, text remains accessible | shared |
| Return list, account, onboarding | `AppShell`, `AccountSettings`, `LoginCard`, `GitHubRepoChooser`, `PiDeviceSignIn`: consume shared sizing and primitives; no onboarding/account behavior change here | later slices |

## Component contracts

- `ConversationFrame`: header, stream, footer slots, no data fetching or scroll decision. Grid min-height/overflow, responsive column; parent owns focus and reading position. Landmarks keep native heading, section and editor semantics.
- `AppShell`/sidebar frame: connection/rail/main/overlay slots, collapsed flag controlled by application; responsive grid only, no route selection. Navigation stays a labelled nav; skip link reaches main.
- `Button`: label, variant, size, availability and pending, `onPress`. Disabled reason stays adjacent. Keyboard activation and focus remain React Aria's; uses size/radius/colour tokens.
- `StatusMark`: label, tone, semantic mark (working, read-only, success, error, unknown, pill), optional running animation; no state inference. Text is always exposed; glyph decorative. `Badge` is a pill presentation of the same mark.
- `Icon`: named decorative SVG with currentColor, aria-hidden; caller owns accessible label and click behavior. No font glyph fallback.
- `Message` and `AgentHeader`: keep existing display props and intent callbacks. Message variant is explicit rather than a reading-view ancestor override; title remains inspectable and expandable until the conversation slice settles its alternate full-title disclosure.

## Draft state mapping

| Draft | Current source | Here |
| --- | --- | --- |
| Working, ready, read-only, unknown | `activityLabel`, `controlLabel`, `activityAnimated` from app | No inferred changes; mark presentation only |
| Complete, failed, unknown message | `AssistantMessage.streamState` | Keep messages and explicit failure/unknown text |
| Rejected, uncertain send | `Composer.sendState`, `UncertainCommandCard` | Keep receipt near composer and draft intact |
| Offline/stale | `ConnectionBanner.state`, snapshot validity | Keep one app banner, no retry of send |
| Repo success/partial/uncertain | `GitHubOnboarding` reconciliation | Keep partial and uncertain, do not collapse to error |
| OpenAI preparing/interrupted/connected | `PiDeviceSignInView.phase` | Unchanged; onboarding slice |

## Deviations and requests

- Handoff says hide ordinary status, remove radio modes, move uncertain-send bubble, always open at latest and remove the full-title toggle. Existing `production-v1.md` and `docs/ui.md` retain explicit control status, send-mode semantics, reading position and full-title access. Defer these interaction changes to the conversation slice; keep current behavior here.
- Handoff wants only success/error for repo fetch; reconciliation can remain uncertain. Existing truthfulness agreement prevails; onboarding slice must preserve unknown result.
- Draft's default monthly repo filter contradicts the agreed all-visible default. Do not implement it.
- Provisional v2 sizing table supersedes v1 draft-size reference for shared dimensions; phone width is in scope for the frame. This slice does not invent a new mobile account/settings flow.
- No host/contract changes requested in this foundation slice.
