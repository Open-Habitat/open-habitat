# Result

A Soniox key is now saved only once Soniox has taken it, under the region it
took it in, and the region picker is gone from both forms.

- Person's own key: the daemon mints a temporary key in the US, and after a
  401/403 in the EU, and stores the region that answered. A key no region takes
  answers `speech_key_rejected`; a Soniox limit or an unreachable Soniox saves
  nothing (`speech_limit_reached`, `speech_unavailable`). The page says
  *Avain tallennettu. Soniox hyväksyi sen USA-alueella.* or why it was not saved.
- Site key: the gateway asks the setting administrator's own daemon
  (`/internal/v1/speech/key-check`, through the broker's authorize route like
  the gives) and stores the region it found; nothing is stored or given before.
- Stored wrong regions heal: a mint that gets 401/403 in the stored region
  tries the other once, starts the dictation there and rewrites the key file's
  region (only if the file is unchanged since the read). Jari's site copy on
  Birch heals at its first dictation after the release.
- Fakes: the browser host's Soniox has an API address per region and per-key
  regions (`action=key-region`); the daemon tests use a regional fake; the
  gateway fake daemon answers checks from per-key regions.

Review: independent `/llm-review` (finder gpt-6-astra, boundary verifier
claude-fable-5-1), no findings; `/assess-findings` dropped two notes.

## Decisions for later review

- **The gateway still never uses the site key; its check runs in the
  administrator's own daemon.** Alternatives: the gateway mints at save time
  (breaks the rule in `internal/AGENTS.md` that the gateway never uses the key,
  which is Jari's), or no save-time check for the site key (healing only).
  The administrator's daemon already receives the site key in the gives, so
  the check adds no new holder of the key.
- **No region picker.** A Soniox project key works only in its project's
  region, so the region is a fact about the key, not a choice. Probe order is
  US then EU (Soniox's default region first).
- **Network failure or Soniox limit at save time refuses the save** instead of
  storing an unchecked key. Dictation needs Soniox anyway, so storing an
  unchecked key would buy nothing; the message asks to retry.
- **Only a 401/403 moves on to the other region.** A limit or an unreachable
  region ends the search, so a network blip never makes the daemon guess a
  region.
- **The gateway's existing site-key record is not healed.** It has no way to
  know without a check; the administrator page shows the stored (possibly
  wrong) region until the key is saved again, and every copy heals at mint.
  On Birch, re-saving the site key once fixes the record.
- **The check counts against the daemon's ten-mints-per-minute bound** like a
  dictation, so a looping browser cannot spend Soniox calls through saves.
- The dictation notice for `speech_key_rejected` is unchanged: after this
  change it means the key was refused in both regions.
