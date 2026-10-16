# Result

Round `design-system/prototypes/rounds/2026-10-16-latausnakyma/` covers the loading
landing, from the first paint until the home page (the chosen Etusivu, Työtilaosiot)
appears. To build it, run `node build.mjs rounds/2026-10-16-latausnakyma` from
`design-system/prototypes/`. This writes `dist/2026-10-16-latausnakyma.html`.

- Keys 1–4 switch pages and R replays the load.
- The page bar's **Lataus** select picks one of four loads: Hidas (about 5 s), Nopea
  (0.2 s), Hyvin hidas (about 15 s) or Epäonnistuu. `?load=fail` in the URL does the
  same.
- The page bar also shows a clock and the current step. Neither belongs to the product.

Today's loader, captured in the synthetic lab with a delayed snapshot, is in
`lab-nyt-tyopoyta.png` and `lab-nyt-puhelin-tumma.png`. Page 4 reproduces it in the
same harness, so the directions can be compared against it.

## Axis and directions

**Axis: what the wait shows.** The load is the same on every page and follows
`App.tsx` `load()`:

1. The bundle loads. index.html has painted, React has not run.
2. The account session is read.
3. The Pi status is checked (first load only).
4. `/api/v1/snapshot` is read.

Every new direction shares three rules:

- **No flash.** Nothing that looks like a loader appears until 300 ms after navigation.
  A loader that did appear stays at least 500 ms. A fast load (Nopea) paints the home
  page directly; the clock reports "latausnäkymää ei näytetty".
- **Slow is said in words.** After 8 s, a calm line appears: "Palvelin vastaa
  tavallista hitaammin. Odotetaan yhä; voit jättää sivun auki."
- **Failure keeps its place.** The failure is shown in the direction's own layout,
  with the production reassurance ("Tämä ei tarkoita, että työtilasi olisivat
  kadonneet") and Yritä uudelleen. Retrying re-reads the session and the snapshot and
  skips Pi, as `piChecked` does today, then lands on the home page.

Reduced motion stops the sweep, the pulse and the bar. The text carries the state.

| Page | What it decides |
|---|---|
| 1 Merkki | The landing belongs to the product, not the app. It has no frame. In the middle are a mark (an arch with a dot, a placeholder), the "Open Habitat" wordmark, the server name in mono, a thin accent bar, and one line: "Yhdistetään palvelimeen…", then "Hei Jari. Haetaan työtilojasi…" once the session is known. The frame and the home page arrive together with a short fade. Because the markup is static, index.html can carry it, so it is the only direction that shows something before the bundle runs. Its cost: the first view of the app is a different place from the app. |
| 2 Runko | The frame appears as soon as React runs: sidebar, top bar "Etusivu", and the real heading "Työtilat". Below it are skeleton shapes in the home page's own layout (workspace sections, two-column cards, the "Ei avointa työtä" rows). The sidebar has skeleton rows, and its foot shows the account once the session is read. Content fills into place, so the layout does not jump. On failure the skeleton stops and dims, an error notice takes the top, and the sidebar says "Työtiloja ei saatu". Its cost: skeletons promise a shape before the host has said anything, and they are the most code to keep in step with the home page. |
| 3 Vaiheet | The frame and the heading "Työtilat" appear first. Where the home content will go, a short list shows the steps the host really takes: Istunto ("Kirjautunut GitHubilla: Jari"), Pi ("Pi on käytettävissä"), Työtilat ("Luetaan työtiloja palvelimelta `open-habitat-test`…"). Each step has a done, working, failed or pending mark, and a step running longer than 1 s shows its seconds. On failure the completed steps stay ticked and the failed one gets ×, so the page can say that sign-in and Pi are fine and only the workspace read failed. Its cost: the most technical of the three. It tells the honest story, but it is more than a person needs when the load is fast. |
| 4 Nykyinen | Production today, for comparison: a bare "Ladataan / Haetaan työtiloja…" with the top banner "Ladataan palvelimen tilaa · Haetaan tuoreita tietoja…". It appears as soon as React runs, even on a fast load, and fails to "Yhteyttä ei saatu". |

## Host facts the view assumes

- **Load order:** session, then Pi status (first load), then snapshot. This is
  `App.tsx` today. The app does not yet expose which step it is in. Directions 1 and
  3 need that as client state, but no host or contract change.
- **Name:** the account session's profile gives the first name ("Jari") before the
  snapshot arrives.
- **Server name:** before sign-in, the only server name available is the page's own
  origin (`location.host`). The prototype shows `open-habitat-test`, as the sidebar
  does. A friendlier name would have to be in index.html or come from a pre-session
  endpoint.
- **Before the bundle:** only direction 1 shows anything before the bundle runs, and
  it needs static markup and CSS in `web/index.html`. `theme-bootstrap.js` already
  sets the theme before the first paint, so dark mode does not flash white. The
  shared 300 ms delay has to be measured from navigation start
  (`performance.now()`), not from when React mounts.
- **Failure:** the failure shown is the snapshot read failing (`daemon_unavailable`:
  403, 5xx or network). These are outside this round, because they leave the loader
  for views of their own:
  - a session that needs login (LoginCard)
  - a missing Pi sign-in (onboarding)
  - a stale snapshot during a later refresh (the stale banner)
- **Failure reason:** nothing tells the step list why the read failed beyond the
  status. It says only "Palvelin ei vastannut."

## Questions for Jari

1. Which direction do you want: Merkki, Runko or Vaiheet? A hybrid is possible: Runko
   or Vaiheet in the frame, with Merkki only before the bundle runs.
2. Should Open Habitat have a mark at all? None exists in `design-system/`. The arch
   with a dot in Merkki is a placeholder, not a proposal.
3. Is "Hei Jari" right for the first view of the day, or too familiar for a tool?

## Decisions for later review

- **Axis:** I chose "what the wait shows" over motion or density. Jari's complaint was
  that the view is bare. Motion and density are refinements once the direction is
  chosen.
- **Comparison page:** I added a fourth page, Nykyinen. It reproduces production in
  the same harness, including its flash on a fast load. It is a reference, not a
  contestant.
- **Timing thresholds:** a 300 ms reveal delay, a 500 ms minimum, and the slow line
  at 8 s. These are common values, not measured from the test server.
- **Home page copy:** the home page is a copy of `etusivu/round.{js,css}` inside the
  round. There are two changes: the home renders through `window.__home`, and its
  click handler stands still while loading.
  - Library proposal: move the chosen Etusivu into `lib/home.{js,css}`, so rounds that
    end on the home page do not copy it.
  - `stage.js` follows the bottom of the stage. The round turns that off, and the
    home page needs the same, because it currently scrolls to its bottom when it
    opens: `following = false` and `scrollTop = 0`. Proposal: `lib/` should not
    follow on non-conversation pages.
- **Review level:** I chose a focused self-review. The round is prototype HTML and JS
  with synthetic content, and the issue needs no architecture sketch. Nothing here
  touches credentials, the Unix-user boundary or authority, so I ran no `/llm-review`.
- **Verification:**
  - `check.mjs`: light, dark and phone, clean console.
  - A timed script took screenshots of every direction × load at fixed instants and
    clicked Yritä uudelleen through to the home page.
  - Under reduced motion, no element was animating.
  - After the hand-off, a card opens its conversation and Etusivu returns home.
  - Clicks during the load are inert, except the phone drawer.
