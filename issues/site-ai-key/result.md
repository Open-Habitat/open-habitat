# Result: site AI key

## What landed

- **Gateway store** (`internal/gateway/site_key.go`): the key lives in
  `/var/lib/open-habitat-gateway/site-ai-key.json` (gateway UID, `0600`),
  beside but outside `administration.json`. Reads return provider, suffix and
  `set_at` only. `set` writes the key file and then the offer `site_key`;
  `delete` writes the replacement offer and then removes the file. A key file
  whose offer is not `site_key` is an unfinished change and is removed at load.
  A key file that is not the gateway's private record fails startup closed. A
  document write can neither set nor leave `site_key` (`site_key_unavailable`,
  `site_key_stored`).
- **Browser API**: `POST /api/v1/server/onboarding/ai-key/set {provider, key}`
  and `…/delete {offer}`, administrator + CSRF; both answer the onboarding
  configuration, now with `site_key {provider, suffix, set_at}`
  (`contracts/v1/server-onboarding.schema.json`).
- **CLI**: `open-habitat admin ai-key show|set --provider … --key-file -|delete
  --offer …`, each write with `--dry-run`; `CONFORMANCE.md` "Admin ai-key
  batch".
- **Seeding**: only in the handoff of the login whose `ensure` replied
  `created`, in the same one-time request as the token and the repository plan
  (`internal/transport`). The daemon's Pi helper action `seed` decides inside
  `AuthStorage.modify` (Pi's file lock) and writes only when the provider has no
  entry of any kind; it makes the key the default only for a person with no
  default. The reply's `seeded | already_present | failed` goes into the
  sign-in receipt (`ai_key`, also `not_offered` and `unknown`). Nothing
  retries; later logins carry no seed.
- **UI**: Käyttöönotto › AI-tili as *Kolme tapaa* (Henkilö valitsee / Oletus /
  Sivuston avain). Leaving the key's way asks first and removes it with the
  replacement offer. The person-side read turns `site_key` into `all`.
- `internal/AGENTS.md` names the site key as the one exception to "the host
  keeps no credential store".

## Evidence

- Go: `internal/gateway` (`TestSiteKey*`: no key in administration state,
  replies, person read, control show or logs; dry runs write nothing; load
  removes interrupted changes and fails closed on a bad file; seed only in the
  creating login, none after a lost handoff or on a later login; receipt keeps
  the answer), `internal/transport` (`TestHandoffSeed`,
  `TestSeedReplyMustAnswerTheSeed`), `internal/daemon` against the pinned Pi SDK
  (`TestSeedSiteKeyWritesOnlyWhereAbsent`,
  `TestSeedSiteKeyKeepsAKeySavedUnderTheLock`: a second login holding Pi's lock
  saves its own key while the seed waits; the person's key stays),
  `internal/cli` (`TestAdminAIKeyCommands`).
- Web: unit tests for the Kolme tapaa flow, the key writes and the edit hold
  during a key write; `web/tests/site-ai-key.spec.ts` (seeded first sign-in
  lands in Työtilat with the key in the person's own native credentials; a
  failed seed shows the AI step with all five options).
- Contracts: `validate-contracts.py` with negative cases (a reply carrying the
  key, a non-literal key, `site_key` as a replacement offer).
- Review: `/llm-review` at critical rigor (finder gpt-6-astra, verifier
  claude-fable-5-1) and `/assess-findings`: one must-fix (a key write could
  silently drop a concurrent document edit) and two low findings fixed in the
  review-fix commit; one finding refuted.
- Not proven here: a real provider key, distinct UIDs, the test server. That is
  the `KOKEILTAVAA.md` line.

## Decisions for later review

1. **A seeded person skips the whole first-login route, not only the AI step.**
   The browser shows the route only while Pi status is `missing`, and ADR 0030
   relies on that rule ("usable Pi credentials end onboarding"). So a seeded
   person also skips Git identity, Repot (in `preselected` mode they pick
   nothing) and the integration steps; `auto`/`skip` defaults are still
   imported. I kept the rule rather than adding a new "onboarding in progress"
   signal in this issue, and filed it as `marginally-immense-crown`.
   Alternative: carry the receipt's `ai_key: seeded` in the person-side read
   plus a person-owned "route finished" mark.
2. **The seed answer `already_present`** (the person's Pi already had a
   credential for that provider, which stays) beside the ADR's
   `seeded | not_offered | failed`, and **`unknown`** when the handoff's answer
   is lost, following "an uncertain outcome stays uncertain". The receipt view
   (`onboarding-signin-receipt`) shows these.
3. **What blocks a seed.** It is written whenever the provider entry is absent,
   even beside another provider's key or a subscription. It becomes Pi's default
   only when the person has no default yet, so it never moves someone's
   conversations onto the site's bill. Alternative: seed only when the person
   has no usable credential at all.
4. **The key must match the provider:** `sk-ant-…` exactly for Anthropic and
   never for OpenAI or DeepSeek, beside the daemon's literal-key rule. It is
   checked in the gateway, the CLI and the browser.
5. **Replacing a stored key** keeps the onboarding version (the document is
   unchanged); setting the first key and deleting bump it, so another tab's
   autosave meets `version_conflict`.
6. **Key writes have no `expected_version`**, as the spec's CLI shape has
   none: set changes only the offer, and a concurrent document write then
   conflicts.
7. **A seed handoff has a 20 s deadline** (5 s otherwise), because the daemon
   runs native Pi after the token and the plan.
8. **The upgrade operator's gateway-state digest** (`sessions.json`,
   `administration.json`) does not include the key file, so no key-derived
   value enters an upgrade proof. The file persists in the state directory
   across upgrades like the others.
9. **A key file that cannot be removed after a committed delete** is reported
   as deleted with a degraded log line. It is inert (no offer `site_key`) and
   the next start removes it, failing closed if it cannot. Reporting the
   delete as failed would make its retry refuse (review finding, refuted).
10. **An offer of `site_key` whose key file was removed by hand** loads,
    seeds nothing, shows the person every option, and can be left with
    delete. Failing startup would take every login down over an optional
    credential.
