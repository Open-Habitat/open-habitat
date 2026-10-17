# Result

Step 1 of [ui-responsiveness-review](../ui-responsiveness-review/analysis.md).

## What changed

- **Refresh shape.** `web/src/app/App.tsx` used to run session read → snapshot
  → session read before the screen changed. It now starts `/auth/session` and
  `/api/v1/snapshot` side by side. A write therefore costs two round trips
  before the screen changes (write, then the parallel pair), not four.
  On first load the session read runs beside the Pi status check, and the
  snapshot follows. The extra session read the Pi gate needs is still there,
  because Pi status names no identity.
- **Identity separation.** `/auth/session` now returns `web_identity_id`
  (`contracts/v1/account-session.schema.json`). The gateway computes it with the
  same function the proxy already uses for `X-Agent-Host-Identity`, which the
  daemon checks against its own derivation. The browser renders the snapshot
  only when both reads name the same identity. On a mismatch it clears the
  person and reads again. After three mismatches in a row it shows
  "Yhteyttä ei saatu". A CSRF that differs from the bound one clears the
  person, as before. A 401 from either read opens login, even when the other
  read fails (`bothReads`).
- **Model catalog.** The sidebar's default-agent observation (`loadPiModels`)
  is read once per identity. After that it is read again only on a confirmed
  default save, on leaving settings, or on an explicit recheck. Workspace-route
  entry no longer reads it. `PiModelsProvider` still loads the shared catalog
  once per identity, plus on its 60 s / focus refresh; that is out of scope
  here.

## Lab measurements

`scripts/lab.sh` (production bundle, synthetic homes), headless Chromium, three
runs per cell, medians in ms after pointerdown. Raw data:
[lab-before.jsonl](lab-before.jsonl) (base `4f6610d5`, after `fast-snapshot`)
and [lab-after.jsonl](lab-after.jsonl), produced by
`issues/ui-responsiveness-review/measure-actions.mjs` and summarised with its
`summarize.mjs`.

| Action → milestone | 0 ms before / after | 100 ms before / after | 200 ms before / after |
|---|---|---|---|
| Workspace hide → gone from rail | 73 / 72 | 482 / 249 | **877 / 464** |
| Undo hide → back in rail | 67 / 50 | 477 / 252 | 879 / 445 |
| Rename → rail renamed | 76 / 81 | 478 / 249 | 886 / 453 |
| Card restore → card back | 73 / 83 | 462 / 263 | 885 / 457 |
| Card archive → card gone (masked) | 26 / 29 | 20 / 26 | 25 / 23 |

At 200 ms emulated latency, hide drops from 877 to 464 ms, which is two round
trips plus local work. The acceptance target was "~450 ms or better". The rest
of that time is the write itself plus one parallel read. Removing it needs
step 2/3 of the analysis (pending overlay, mutation replies with resources).
In the lab the snapshot is ~40 ms, so these figures isolate the request shape.
Live, each saved round trip is ~0.2 s through Cloudflare (analysis,
`live-rtt.sh`), so a workspace action should be ~0.4 s faster there. Nothing
was measured live: this build has not been released yet, and nothing on the
test server was touched.

The `create_and_send` scenario was left out of the after-run. In the
before-run it failed at 100/200 ms because of the known per-user capacity of
four controlled Pi processes (analysis, pattern 7). It does not exercise the
refresh shape.

## Tests

- `web/tests/refresh-identity.spec.ts` (6 cases):
  - the snapshot leaves while the session read is still held
  - a snapshot for another identity than the session never renders (the
    cookie is switched to Bob between the two reads; the tab ends as Bob with
    Bob's CSRF, so a following write succeeds). Removing the identity
    comparison makes this case fail; this was checked by mutation.
  - a 401 session read beside a good snapshot opens login
  - a 401 session read beside a failed snapshot opens login
  - persistent disagreement ends on "Yhteyttä ei saatu" after three tries
  - workspace navigation does not read `/api/v1/pi/models` again
- The `internal/gateway` auth test checks the session's `web_identity_id`.
- `new-conversation-placeholder` "sidebar + opens a stable conversation": the
  faster refresh moved the swap from the placeholder to the real conversation
  into the test's measurement. The test now polls until the box resolves. The
  layout comparison itself is unchanged. This case failed 4 of 20 on this
  branch and 0 of 20 on base before the fix.
- Full browser suite: 213 passed. The one failure was the known pre-existing
  `account-settings` "native key add". Lab specs passed, web fast checks
  passed, gateway Go tests passed, contracts check passed. `placeholder lost
  creation reply` is intermittent under 8× repetition on base as well
  (1 of 8), so it is not caused by this change.

No visual change, so no paired screenshots.

## Review

Independent `/llm-review` (finder gpt-6-astra, verifier claude-fable-5-1),
because the change touches sessions, authentication and the contract. Two
findings were confirmed and fixed: a 401 could be lost when the other parallel
read failed, and the third identity mismatch was fenced by its own
`clearPerson` and left the tab loading.

## Decisions for later review

- The session read stays on every refresh, in parallel, rather than only on
  identity change. In parallel it costs no latency. It still detects a
  same-person re-login in another tab, which changes the CSRF without changing
  the identity.
- `web_identity_id` is a required field of `/auth/session`; pre-release, no
  compatibility.
- After three consecutive identity mismatches the tab shows the generic
  unavailable view rather than a dedicated one. This can only happen if the
  gateway and daemon disagree on derivation, which the daemon already refuses.
- Leaving settings rereads the sidebar default. A credential change or a Pi
  sign-in in settings can change it without a model save.
