# Result

The app page's CSP is now `frame-ancestors 'none'; frame-src <sources>`, where
the sources are derived once from the configured view and editor templates
(`appFramePolicy` in `internal/gateway/server.go`), or `'none'` when neither is
configured. Every legitimately framed thing was checked: the view frame
(per-view host), the editor frame (per-person editor host) and the Word
preview (`srcdoc`, not a fetch, unaffected). Redirects on view and editor hosts
are relative, so they stay inside the source.

Tests: `TestAppFramePolicy` (template forms), updated app-header assertions,
and `agent-views.spec.ts` "a view cannot navigate its frame to a foreign
origin" (the view's script sets `location.href` to a foreign origin; Chromium
reports a frame-src refusal and no request leaves). Without the fix that spec
fails (negative control run). Whole browser suite: 417 passed, 3 skipped.
Review: independent `/llm-review` at critical rigor (GPT-6 Astra finder,
Claude Fable 5.1 verifier): no findings.

## Decisions for later review

- **Wildcard width.** CSP host wildcards cover only whole leftmost labels, so
  the documented template `https://oh-view-*.example.org` becomes
  `frame-src https://*.example.org`: every host of the operator's parent
  domain, not only view hosts. Alternatives: exact per-view hosts (impossible
  statically: a view's host is not known until it is offered, after page
  load); requiring whole-label templates such as `*.views.example.org`
  (would need another wildcard certificate, which the operations guide avoids
  on purpose). Chosen because it blocks every truly foreign origin with the
  existing configuration; residual: on a shared parent domain the operator
  does not control, siblings stay frameable.
- **Exact editor host per request** (verifier's note). With views and editor
  under different parents, naming the session's own editor host per request
  would be narrower. Not done: no gain in the documented same-parent setup,
  and it would turn a fixed header into a per-session one.
- **No `child-src`.** Every browser in scope honours `frame-src`; adding
  `child-src` would also constrain workers through fallback for no gain.
