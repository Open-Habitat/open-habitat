# Result

The Merkki landing from round `2026-10-16-latausnakyma` replaces the bare "Ladataan / Haetaan työtiloja…" view and the "Yhteyttä ei saatu" failure view.

- **Before the bundle.** `web/index.html` carries a static copy of the landing: the placeholder mark, "Open Habitat", the server name and the accent bar, with "Yhdistetään palvelimeen…". A classic script, `public/landing-bootstrap.js`, fills in the server name (`location.hostname`) without an inline script, and adds the slow line if the bundle is still loading at 8 s. The production CSS link sits in the head, so the static copy is styled from the first paint. A CSS animation delay keeps it invisible for 300 ms.
- **During the load.** React renders the same markup through `components/Landing.tsx`. `app/landing.ts` (`useLanding`) does the timing:
  - The first load is measured from navigation start (`performance.now()`), and a later load from its own start.
  - Nothing shows before 300 ms.
  - A landing that has shown stays mounted for at least 500 ms, including the first render after the load finishes.
  - The slow line appears at 8 s.
  - After a shown landing, the frame fades in over 220 ms, opacity only. A fast load paints the home page directly.
  - Once the account session has been read, the line says "Hei {etunimi}. Haetaan työtilojasi…".
- **Failure.** A failed snapshot read (`daemon_unavailable`) shows in the landing's own place: the dot stops, the bar turns to the error line, and the page shows "Työtiloja ei saatu näkyviin", the production reassurance and Yritä uudelleen. A retry keeps the landing visible and skips the Pi check, as `piChecked` already did. Focus goes to the failure line.
- **Reduced motion.** The global rule stops the pulse, the sweep and the fade, and the bar stands still at half opacity. The static copy's 300 ms delay stays as an instant step, because it is a delay, not motion.

## Evidence

Paired lab captures, made with `capture.mjs`, are `lab-{desktop,phone}-{light,dark}-*`:

| Capture | What it shows |
|---|---|
| `before-bundle` | The static landing while the bundle is held. Screenshot only, because the HTML twin would have to fetch the held bundle. |
| `loading` | The greeting while the snapshot is held. |
| `slow` | The slow line after 8 s. |
| `failed` | The failure after a 503 snapshot. |
| `fast-home` | An ordinary local load, where no landing appeared. |

Tests:

- `tests/loading-landing.spec.ts` is host-backed synthetic evidence. It samples the landing's opacity on every frame from navigation start.
  - **No flash.** On an ordinary load, the landing is never visible before 300 ms and, if it showed, stays at least 480 ms. A snapshot released the moment the landing appears must still keep it at least 480 ms. Setting the minimum to 0 makes this case fail with 105 ms.
  - **Slow.** The slow line is absent before 8 s, appears after it, and leaves on landing.
  - **Failure.** The failure stays centred in place, and Yritä uudelleen reaches the home page.
- `src/app/landing.test.tsx` covers the timing rules under React StrictMode with fake timers.

## Test-server timing

These are read-only gateway logs from the last three days. The gateway logs only requests it marks slow.

- 9 slow `GET /api/v1/snapshot`, 1.0–1.25 s.
- 2 slow first-load Pi status reads, 1.5–1.9 s.
- Nothing near 8 s.

So a first load there usually shows the landing, and the slow line should be rare.

## Decisions for later review

- **Failure keeps the fallback account.** The failure view keeps the frame's fallback account (the account button at the rail foot or the phone's top right), which the round did not show. A person stuck in an outage keeps settings and sign-out, and `lab-outage-account` requires this. The landing itself stays centred in the viewport.
- **Headings.** The wordmark is the page's `h1`. The failure line is an `h2`, and focus goes to it. Tests that looked for the "Yhteyttä ei saatu" heading now look for "Työtiloja ei saatu näkyviin".
- **Every loading phase.** The landing covers every `loading` phase, including the reload after an identity change, not only the first page load. The timing then counts from that load's start.
- **"Hei {etunimi}".** The greeting uses the first word of the account profile name, and it disappears when there is no name. The round's open question about familiarity was not answered, so the round's wording stands.
- **Server name.** The server name is `location.hostname`, as the round's host facts proposed. A friendlier name would need a pre-session source.
- **Slow line moves the block.** The slow line moves the centred block up by about one line, as in the prototype.
- **Review level.** This touches session handling in `App.tsx`, so it got an independent `/llm-review`. The finder was gpt-6-astra and the verifier claude-fable-5-1. It confirmed three defects, all now fixed:
  - The destination mounted for one commit inside the hold. A commit-level unit test now fails on the old hook.
  - `?pi_sign_in` bypassed the hold.
  - The static copy had no slow line.

  The review found no cross-identity path: the hold renders only the landing and the session's own first name.
- **Failure appears without a fade.** The failure view appears without a fade, so it is never seen, or audited by axe, mid-fade.
