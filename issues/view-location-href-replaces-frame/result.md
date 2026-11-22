# Result: navigation preservation needs a different approach

The reported loss of the document is reproducible. No sandbox or CSP was
loosened, and no ineffective navigation guard was shipped. This issue remains
open; the worktree is preserved rather than merged as a completed fix.

## Evidence

A disposable Chromium page served a view with `sandbox="allow-scripts"`, the
matching CSP sandbox, `connect-src 'none'`, and a parent `frame-src` policy.
The view registered a `navigation` listener that would call `preventDefault()`.
A real button then assigned an external address to `location.href`.

- `navigation.currentEntry` was null.
- Both `window.location` and `location.href` were non-configurable.
- No `navigate` event fired.
- The parent CSP blocked the foreign request; zero foreign requests reached the
  interception fixture.
- The frame became `chrome-error://chromewebdata/`; its original document was
  gone. This is refusal of the network load, not preservation of view state.
- A parent `securitypolicyviolation` listener did receive an enforced
  `frame-src` violation. This can signal a refusal for a recovery UI, but does
  not cancel navigation or preserve state.

The local probe and log are retained in `/var/tmp/agent-keep/views-jhtfx7/`.
The existing `agent-views.spec.ts` test confirms the production parent CSP
refuses the external load, but does not assert document preservation.

The HTML Standard's Navigation API core infrastructure disables entries and
events for opaque origins (`https://html.spec.whatwg.org/multipage/nav-history-apis.html#navigation-api-core`).
Its Location interface marks the navigation setters LegacyUnforgeable. The
iframe sandbox flags do not include a flag that forbids the frame navigating
itself while retaining scripts. These explain why the suggested injected
Navigation API guard and setter override cannot implement this requirement.

## Decisions for later review

- **Keep the opaque sandbox and existing CSP unchanged.** Adding
  `allow-same-origin` to make Navigation API events available is outside the
  authorized security boundary. It is not an acceptable implementation shortcut.
- **Do not inject a guard that claims to block arbitrary location assignments.**
  Click interception could stop ordinary links, but not this reported JavaScript
  assignment. Text substitution or wrapping arbitrary export JavaScript is not a
  complete interception mechanism and could break otherwise working bundles.
- **Recommend an explicit reopen action as the next bounded product choice.**
  Reopening can recover the frozen view without granting new authority, but it
  cannot preserve its in-memory state and must not be sold as prevention. A
  parent load event alone cannot distinguish an opaque error document from a
  legitimate same-bundle navigation. The parent CSP violation event is a
  possible recovery trigger; it does not identify which frame navigated, and
  destinations already permitted by `frame-src` do not trigger it. An automatic
  recovery design would need to handle these limits and avoid reload loops.
  Neither a manual reopen nor automatic recovery meets this task's requested
  preservation of the live document.

## Limits

Independent critical review (claude-fable-5-2 finder, gpt-6-astra verifier)
confirmed the limits of the proposed guards and corrected the recovery
recommendation to account for the parent's CSP event. `/assess-findings`
recorded that correction. This is not a universal impossibility claim about
every possible redesign.

No runtime fix, no preservation claim, no installed-server or other-browser
qualification. The required preservation acceptance remains unmet. The terminal
report must be unsuccessful and must not merge this branch as a completed fix.
