# Result: a seeded person walks the first-login route

## What landed

- **Gateway** (`internal/gateway/onboarding.go`): the person-side read
  `GET /api/v1/onboarding/site` carries `ai_key_seeded: true` exactly when
  that person's receipt says `ai_key: seeded`. It is never derived from the
  current offer, so a key stored after someone joined marks nobody.
- **Daemon** (`internal/daemon/first_route_linux.go`): `GET/PUT
  /api/v1/account/first-route` reads or creates the person's own mark
  `~/.local/state/open-habitat/first-route-finished` (O_NOFOLLOW directory
  chain, O_EXCL leaf, owner checks). The only write is `{"finished": true}`;
  nothing takes it back. The gateway relays it through the same handler as the
  editor preference (`personalSetting`), CSRF on PUT.
- **Contract**: `site-onboarding.schema.json` gains `ai_key_seeded`;
  new `first-route.schema.json` with an example and negative checks.
- **Browser**: the first-load gate (`App.tsx`) enters the route while Pi is
  usable when the read says seeded and the mark is absent, on `/` and
  `/workspaces` only. `GitHubOnboarding` drops the AI step from the route for
  a seeded person; after the last step it checks Pi, writes the mark and lands
  in the workspaces. A seeded Pi that is no longer usable brings the AI step
  back, and finishing it also writes the mark.
- `internal/AGENTS.md`: the mark is the person's own state, the gateway never
  records route progress.

## Evidence

- Go: `internal/gateway` (`TestSiteKeyReceiptRecordsTheAnswer`: only a
  `seeded` receipt sets the flag, a key stored later marks nobody;
  `TestBrowserRoutesHTTP2` covers the new route), `internal/daemon`
  (`TestFirstRoute*`: read creates nothing, finish is kept and idempotent,
  links at every level are refused and nothing is written outside the home,
  HTTP shape and peer refusal).
- Web unit: the seeded route has no AI step and ends with the mark; a lost
  mark still ends the route; a non-usable seeded Pi brings the AI step back;
  a mark settling after a session change does not end the next person's route.
- Browser: `web/tests/site-ai-key.spec.ts` (seeded Bob walks Git identity,
  Repot and a Google step without the AI step, lands in Työtilat, his mark
  reads finished and a reload goes straight to Työtilat; a failed seed still
  shows the AI step with every option). Whole browser suite: 362 passed, 3 skipped.
- Review: `/llm-review` routine rigor on a high-risk surface. Finder
  gpt-6-astra found one should-fix (the stale completion above), confirmed
  locally and fixed with a test. Verifier claude-fable-5-1, asked one focused
  question on the authorization boundary (another person's mark, writes
  outside the home, links, receipt disclosure, cross-site write): no findings.
- Full gate (`ci-local.sh --clean --json`) once on this branch: Go/contracts
  and packaging passed. Browser had 360 passed and 2 failed, both in untouched
  specs and both under load average ≈9.6: the title-dots case (already filed as
  `altogether-shocking-babies`) and browser-editor lazy compact chains (passed
  4/4 on rerun, filed as `very-wholesale-moon`). No receipt was written.
- Not proven here: distinct UIDs and the test server; that is the
  `KOKEILTAVAA.md` line.

## Decisions for later review

1. **Where "route finished" lives: a mark file in the person's home, written
   by their daemon** (`~/.local/state/open-habitat/first-route-finished`), as
   the editor choice is personal configuration. Alternatives: a mark in the
   gateway receipt (a host-side onboarding registry, ruled out by the
   issue), browser storage (not durable across devices, so the route would
   return on each new browser), or deriving it from native state such as Git
   identity (Git identity is the first step, not the last).
2. **Only seeded people get the mark.** The route of everyone else still ends
   when Pi becomes usable, as before; writing a mark into every home would add
   a write nobody reads. If the route later needs a general "walked" signal
   the same mark can be written for everyone.
3. **The route ends after its last step without an extra screen**: the AI
   step is simply off the route (as the Käyttöönotto preview shows it), and
   the person lands in Työtilat. Alternative: a "Valmis" card at the end.
4. **A mark that cannot be written still ends the route** for that load; the
   next load shows the route again. Onboarding gates no access, and nothing
   retries a write automatically.
5. **An unreadable site read or mark lets the person in** rather than holding
   them in onboarding: an uncertain read is not a reason to show the route.
6. **Only on `/` and `/workspaces`**, where the route is shown at all; a deep
   link goes on and the route waits for the next ordinary load.
7. **The mark is in `~/.local/state/open-habitat/`**, beside the broker's
   `sync-at-boot` signal. The broker only checks that its own name exists, so
   the new file is invisible to it.
