---
created: 2026-10-25
updated: 2026-10-25
type: bug
reporter: jari
status: fixed
priority: normal
lane: unlaned
collision: [web/src/components/Account.tsx]
preparation: ready
closed: 2026-10-25
---

# OpenAI (Pi) settings row says credentials usable when only Claude is signed in

## Description

Jari, 2026-10-25, Birch (account maintainer), Settings → Yhteydet: the
"OpenAI (Pi)" row says "Pi-tunnukset käytettävissä" with "Kirjaudu Pi:hin
uudelleen", although he has not signed in to OpenAI; only the Claude
subscription row is signed in. `~/.pi/agent/auth.json` holds no OpenAI entry.
Screenshot: `~/attachments/e9e09e21-7088-4efe-a600-25810c1e3c17`.

Cause seen by the conductor: `web/src/components/Account.tsx` renders the
row from the account-wide Pi credential state (`piState`), which is
`usable` as soon as any Pi provider credential exists.

Expected: the OpenAI row shows OpenAI's own state (signed in / API key /
missing) and offers "Kirjaudu" rather than "Kirjaudu uudelleen" when missing,
independent of other providers. Where the host contract lacks a per-provider
fact, add it from Pi's native auth state; do not add a separate store.

## Acceptance Criteria

- [x] OpenAI row reflects only OpenAI credentials; regression test with a
  Claude-only account.

## Comments

### 2026-10-25T17:23:00Z · @jari

Jari 2026-10-25 (screenshot ~/attachments/ea8b665e-5c87-4570-b16b-4f9c3b5e08e7, after signing in to OpenAI): the row speaks of Pi ('Pi:n kirjautuminen', 'Pi-tunnukset käytettävissä', 'Kirjaudu Pi:hin uudelleen'); it should speak of the OpenAI / ChatGPT (Codex) sign-in, as the Claude row speaks of the Claude subscription. Pi is the tool, not the account the person signs in to.

## Resolution

### 2026-10-25T17:27:38Z · @issuectl

OpenAI row derived from Pi's own openai-codex/openai credentials; see result.md.
