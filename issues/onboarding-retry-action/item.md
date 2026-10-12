---
created: 2026-10-12
updated: 2026-10-12
type: improvement
status: done
priority: normal
lane: signin-fix
lane_seq: 3
collision: [web/]
closed: 2026-10-12
closed_by: claude
---

# Onboarding notices need a retry action

_Source: chat_

Jari, 2026-10-12, onboarding step 2 on pilot.20 while the test guest was briefly unavailable: the notice "Haun tila vaatii tarkistusta — Istuntoa ei voitu vahvistaa. Lataa sivu uudelleen." tells the person to reload but offers no action, so a stuck state has no way forward from the page itself. Each recoverable onboarding notice should carry its own action: a button that retries the failed check (session check, repository listing, clone status) or reloads the page, as the notice text promises. The earlier "Haun tulos on epäselvä" notice already has "Tarkista haun tila"; make the session and listing failures consistent with it. Keep the rule that a clone is never restarted automatically.
