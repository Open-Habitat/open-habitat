---
created: 2026-10-19
updated: 2026-10-19
type: bug
reporter: jari
status: open
priority: normal
lane: web-polish
lane_seq: 3
collision: [web/src/app/]
preparation: ready
---

# Single-workspace mode: misaligned archive notice and /workspaces URL

Jari on the test server (pilot.231), 2026-10-19, single-workspace mode (one visible workspace `issuectl`):

- An extra notice "Arkistoa ei voitu kokonaan tarkistaa — Osa Pi:n historiasta tai arkistomerkinnöistä on poissa käytöstä. Tyhjä lista ei vahvista tyhjää arkistoa." spans the full content width (≈ from the left page edge to the right edge), while the page content below (Keskustelut, Git pill, Avoimet, Valmiit, Arkistoidut) is a narrower centred column. Its left and right edges line up with neither. Align it with the content column. Also find why the archive could not be fully checked here (it may relate to the idle Pi processes in `idle-pi-holds-slots` or to the archived conversations he had just made) and whether the notice is warranted; if it is spurious, fix the cause.
- The URL was `/workspaces` while showing the single workspace's page. Jari: in this mode this is effectively the home page, so the URL should rather be the home page's.
- Otherwise the mode worked: restoring a second workspace brought the sidebar back, the menu's Siirrä roskakoriin is grey with the reason, and it works on the phone.
