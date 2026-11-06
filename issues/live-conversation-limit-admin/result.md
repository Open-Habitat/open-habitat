# Result

The administrator's **3 Muisti edellä** view is the new section *Keskustelut* (`/settings/conversations`) in the experimental server area, and the limit-reached card follows round 3. The limit reaches each daemon only as root-written configuration:

- the browser's `PUT /api/v1/server/conversations` reaches the gateway, which checks the current administrator role (under the administration writer lock, as storage limits do) and CSRF;
- the gateway asks the root broker (`live_limit_list|set|clear`), naming a person by provider subject only; the broker resolves the committed binding's UID and atomically writes `/opt/open-habitat/live-limits.json` (`{"version":1,"default":N,"people":{"<uid>":N}}`, 0644 root), the pattern of the integration app sections;
- each daemon reads only its own UID's number from that root-owned file (`core.ReadOperatorFile`) at every limit check, so a change applies to the next start; a missing or untrusted file means the daemon's own 32.

The person refused at the limit reads their own daemon's new `GET /api/v1/conversations/capacity` (limit, its source, and which of their own conversations hold a place and why). Nothing reads another person's live usage.

Card: sentence naming the limit and who set it ("Ylläpitäjän asettama raja on…" / "Ylläpitäjä on antanut sinulle rajan…" / the server's own), workspace chips (this workspace first) opening the *Työtiloittain* window with a stop per conversation, *Yritä uudelleen* (with "Yritit uudelleen: yhä täynnä."), *Muuta rajaa (ylläpitäjä)* for an administrator and a disabled *Muuta rajaa* for others (described by the sentence). No *Muokkaa*. A stop that frees a place turns the card into *Tilaa on nyt* with *Aloita keskustelu*.

Evidence: `evidence/` (synthetic lab, screenshot + offline HTML): `admin-1440-light`, `admin-390-dark`, `card-admin-1440-light`, `window-1440-light`, `window-stopped-1440-light`, `card-room-1440-light`, `card-person-390-dark`. Reproduce with `web/lab/live-conversation-limit-admin.mjs` against `scripts/lab.sh start`.

## Decisions for later review

- **Cross-user read: not built (pre-authorized scope).** Round 3's riffi showed each person's "työssä nyt" and a server-wide working count. Only each person's own daemon knows that; showing it would need a new path by which the gateway or admin view reads other people's daemons. Instead the view shows the *whole server's* memory in use (`/proc/meminfo`, read by the gateway; a host fact naming nobody) and the estimate "jos jokainen käyttää koko rajansa" computed from limits alone. **Question for Jari:** should the administrator see per-person or server-wide working counts, and if so through which authority (e.g. counting Pi processes per UID as root, or asking each daemon via the broker)?
- **Writer: the root broker, on the gateway's request after its administrator check** (the integrations-file pattern Jari approved for app sections). Alternatives: host apply from `site.json` (no browser setting) or a gateway-owned file (daemons must not trust gateway state). No host operation lock: the broker is the file's only writer and serializes under its own state lock.
- **File keyed by UID, world-readable.** Every person can see others' UIDs and their exception numbers (no names). Alternative: per-UID files with group permissions; judged not worth it for a non-secret courtesy limit.
- **Limit is courtesy, not security.** An unreadable/malformed file falls back to 32 rather than refusing all starts; a person can still start Pi in a terminal.
- **Ceiling 128** (create's record bound), exceptions capped at 100 (broker message size); a change drops exceptions whose UID no committed binding has.
- **Steppers save 0.5 s after the last press** (one write per adjustment, flushed if the view is left); the prototype had no save button. An unconfirmed write says so and asks to reload.
- **Section listed only in the server area** (experiment on); its route still opens with the experiment off, which the card's administrator button uses. Not in personal settings search.
- **Card details omitted for lack of host data without new reads:** "kirjoitit X sitten" and a background process's command; rows sort by the conversation's last change. The stop is the conversation's ordinary stop (stopping Pi also ends its processes), labelled *Pysäytä vuoro* / *Pysäytä prosessi*.
- **Only the new-conversation refusal uses the card.** A send to a stopped conversation refused at the limit keeps the existing message.
- Section heading is *Keskustelut* (the nav label), not round 3's *Samanaikaiset keskustelut*.

## Validation and review

On Birch (TMPDIR under `/var/tmp`, umask 077, `OH_PORT_BASE=13200`, `OH_BROWSER_WORKERS=2`): focused Go for `internal/livelimits`, `internal/provision`, `internal/gateway`, `internal/cli`, `internal/daemon` pass; contracts valid and generation clean; `--area web` 174 files / 1309 tests pass (after rebasing onto the raise-to-your-turn and composer-lists landings); browser specs `live-conversation-limit.spec.ts` (2, new), `server-settings-area.spec.ts` (3), `mutation-layer.spec.ts` (5) pass. `settings-search.spec.ts`: 4 pass, the index-parity case fails on an unrelated experimental row (`empty-conversation-start-page`) that main also lacks in the index; filed as `adequately-inconclusive-lock`. Host-backed synthetic evidence: one UID for both identities, no real root broker.

Independent review (`/llm-review`, finder gpt-6-astra, verifier claude-fable-5-1) and assessment: (1) a stop was shown as done before the child ended: fixed, the row says *Pysäytetään…* until a capacity read no longer lists it; (2) overlapping stepper writes could leave an older value: fixed, writes are queued and a reply clears only its own draft revision (unit test); (3) the daemon's 128-record bound also returns `capacity_exceeded` and stopped sessions are never evicted, so a long-lived daemon refuses every new conversation and the card blames the limit: pre-existing, spun off as `moderately-free-fan`.
