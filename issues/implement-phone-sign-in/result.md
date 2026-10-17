# Result: phone sign-in by QR (ADR 0018)

ADR 0018 is Accepted (Jari, 2026-10-16). The gateway mints, describes and
redeems one-minute single-use link tokens and lists and ends the person's own
sessions (`internal/gateway/link.go`, contract `contracts/v1/device-link.schema.json`).
Settings has a **Laitteet** section (round `2026-10-17-laitteet`, direction 2,
with Jari's changes), and `/link` is a standalone page that confirms the
account, signs in, and moves on to the home view by itself after 1.2 s.

The session store is version 2 (public id, method, device label, creation and
GitHub sign-in times); a version 1 file is discarded at startup, so **everyone
signs in once more** after this release. Native `gh` disconnect and the
proxy's recent-login header now use the recorded GitHub sign-in time; a link
session inherits its parent's.

## Evidence

- Go (`internal/gateway/link_test.go`): expiry at 60 s, single use, a failed
  redemption (Access-email mismatch) uses the token up, cross-site Origin at
  describe and redeem, CSRF at mint and end, death on parent logout, subject
  revocation, re-mint, cancel and a changed broker binding, a link session
  failing the recent-sign-in check, per-session sign-out that cannot reach
  another person, store v2 round-trip and v1 discard, the device vocabulary,
  and (after review) a parent expiring during the broker call plus status
  staying pending while a redemption decides. Key cases were checked to fail
  under mutation.
- Browser (`web/tests/phone-sign-in.spec.ts`, host-backed synthetic): desktop
  mints, a second context opens `/link#token`, the fragment leaves the URL and
  no request carries the token, confirm → Kirjauduttu → home view signed in;
  desktop hides the code and shows the new device; a third context gets "Koodi
  ei enää toimi"; signing the phone out from the desktop ends only its session.
- The rendered QR decodes (jsQR, outside the repo) to exactly
  `<origin>/link#<token>` in light and dark.
- Lab captures (PNG + HTML) in this folder: `desktop-{light,dark}-{laitteet,koodi,kaytetty,kirjaa-ulos}`,
  `phone-{light,dark}-koodi`, `phone-{light,dark}-link-{vahvistus,kirjauduttu,kotinakyma,ei-toimi}`.
- Neighbouring browser specs pass (settings, security, session, refresh
  identity, theme, accessibility) except the known pre-existing
  account-settings "native key add" failure.
- Independent review (`/llm-review`, gpt-6-astra finder): three findings,
  all confirmed and fixed (parent deadline recheck after the broker call,
  in-flight redemption reported as failed, local countdown hiding a
  last-moment redemption).

## Decisions for later review

- The Laitteet card shows only the title and **Näytä koodi**; the code panel
  shows the QR, "Vanhenee 0.42" with a bar, and **Peruuta**. No explanation,
  no warnings (Jari's decision 2).
- After use the card says "<device> kirjautui." with **Valmis**; the
  prototype's "Oliko se sinun puhelimesi?" question is dropped as a warning.
  The new row is highlighted **Uusi** and has **Kirjaa ulos…**, which keeps
  ADR point 5's guarantee (named device, sign-out at hand).
- Expired: "Koodi vanheni."; a failed redemption: "Koodia ei voitu käyttää.";
  both offer **Näytä uusi koodi**. The phone's dead page keeps one line,
  "Näytä uusi koodi tietokoneelta.", because otherwise the person has no next step.
- The phone's confirmation shows the profile name (or email) and the host in
  the brand line; the GitHub login is not shown because the gateway does not
  keep it and the wire carries no Unix username.
- Leaving the Laitteet section cancels an outstanding code (shown only on request).
- The desktop learns about redemption by polling `GET /auth/link` every 1.5 s
  while the code shows; no event channel was added.
- Prototype questions left at their default: no "sign out all other devices"
  and no last-used time (it would need a write on every request).
- Device labels come from a fixed OS × browser vocabulary; an iPad gets the
  computer icon. Unknown agents show "Tuntematon selain".
- The current browser's row offers the existing **Kirjaudu ulos…** dialog;
  Tili keeps its own sign-out button as well.
- Test-server logs were not consulted: this is a new feature with no live
  report to explain.
