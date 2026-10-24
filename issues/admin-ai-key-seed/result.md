# Result: admin ai-key seed

## What landed

- **Daemon** (`internal/daemon/pi_credentials_linux.go`, `pi_credentials_helper.mjs`):
  the gateway-only route `POST /internal/v1/pi/site-key` with `check` and
  `seed`. The helper compares the gateway's salted fingerprints
  (HMAC-SHA256) with the person's Pi entry in their own UID and answers
  `absent | current | earlier | own`; `seed` decides again inside
  `AuthStorage.modify` (Pi's lock) and writes only for `absent` or
  `earlier`, answering `seeded | replaced | already_current | kept`. A
  replacement leaves settings alone; a first key becomes the default only
  for a person with none.
- **Gateway**: the copies record `site-ai-key-copies.json` (0600, beside the
  key file, outside administration state): salt, known keys (fingerprint,
  provider, suffix, set_at), per subject the given copy's fingerprint and
  time. The person's daemon is reached through the broker's `authorize`
  route, as revocation and device links do. One ops lock serializes gives
  and key changes. Setting a key of the same provider replaces every
  recorded earlier copy (`rotation` in the reply); delete leaves copies.
  The first-login seed is recorded too.
- **Browser API**: `GET …/ai-key/copies`, `POST …/ai-key/check {subject}`,
  `POST …/ai-key/seed {subject, provider, suffix, set_at}`; access-list rows
  and the person's `/api/v1/onboarding/site` carry `site_key_copy`.
- **CLI**: `admin ai-key seed --github-id ID [--dry-run]` and
  `admin ai-key copies`; set/delete dry runs name whose copies are replaced or
  kept; seed and set get a longer control deadline (`AdminControlDeadline`).
- **UI**: AI-avain page as the prototype's "AI-avain-sivulla": *Jo
  liittyneet* card, giving dialog with the one-word check, notices after a
  key change, removal dialog naming holders; Käyttäjät ja pääsy row
  *AI-avain annettu*; the person's Yhteydet key row *Sivuston avain*.
- ADR 0030 and `internal/AGENTS.md` say rotation replaces every site-given
  copy and how the give path keeps the authority split.

## Evidence

- Go: `TestGiveSiteKeyReplacesOnlySiteCopies`, `TestGiveSiteKeyDecidesUnderTheLock`
  (a key the person saves while the write waits for Pi's lock stays),
  `TestSiteKeyHandler` against the pinned Pi SDK; gateway
  `TestSiteKeyGiveAndReplaceCopies` (fake daemons on Unix sockets: check,
  give, own key kept, rotation, unreachable person, unanswered write, no key
  in record/state/logs, 0600 record failing closed) and
  `TestSiteKeySeedControl`; CLI `TestAdminAIKeySeed`.
- Web unit tests for the card, dialog, rotation notice, removal holders,
  the person's badge and the access row; `web/tests/site-ai-key.spec.ts`
  end to end with the native Pi helper (Bob gets the key, Alice's own key is
  never offered or replaced, a new key replaces Bob's copy, a11y, 390 px).
- Contracts with negative cases (a check revealing a credential kind or
  suffix, a seed carrying a key, a copy with a fingerprint).
- Review: `/llm-review` critical (finder gpt-6-astra, verifier
  claude-fable-5-1) and `/assess-findings`: 6 confirmed, 2 fixed (an
  unanswered write is recorded; the rotation notice keeps it uncertain),
  4 dropped as rare (rule 1b) and listed below.
- Not proven here: distinct UIDs, a real provider key, the test server.

## Decisions for later review

1. **Removal does not revoke copies.** Rotation-everywhere replaces copies but
   deleting the key leaves them: deleting would stop people's running work and
   gains nothing over revoking at the provider. The next stored key of the same
   provider replaces those copies.
2. **A key of another provider replaces nothing.** Switching from OpenAI to
   Anthropic leaves OpenAI copies as they are (like removal); the card shows
   them as earlier copies and the administrator can give the new key.
3. **Rotation runs inside the set request**, four people at a time, once; a
   person not reached keeps the earlier key and is named. Behind Cloudflare a
   very long rotation can outlast the edge timeout and show as uncertain; the
   gateway finishes it anyway.
4. **CLI flag `--github-id`** as in `admin access`, not the issue's `--subject`.
5. **The person's badge** is shown while their key row's suffix equals the
   recorded copy's; the text says "Sivusto antoi sen", covering both sign-in
   and administrator gives.
6. **An unanswered or failed write is recorded as given**, so the next key
   reaches it; a later answer of `kept` removes the record.
7. **Dropped review findings (rare, rule 1b)**: a rotation finishing during a
   first sign-in can give the newcomer the earlier key (shown as an earlier
   copy, replaced by the next key); a delete racing a set skips that set's
   replacements (state equals set-then-delete); one record per person across
   providers forgets an earlier provider's copy after a provider switch and an
   explicit give; a set reply with several hundred replacements exceeds the
   browser's 16 KiB read and shows as uncertain.
8. **Withdrawn people are not listed or reached**: the broker no longer routes
   them; their copy stays until the key is revoked at the provider.
