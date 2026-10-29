# Result

A Soniox key is now a plain run of `A-Za-z0-9_-` or up to four such runs
joined by single dots, 16–256 characters in total, whose last run is at least
four characters long. The same rule is in the daemon (`ValidSonioxKey`), the
gateway's site key (`validSonioxKey`), both contracts (`pattern` plus
`minLength`/`maxLength`) and the browser (`validSonioxKey` in `speech.ts`).
The old plain shape and a key file stored with it still validate.

Evidence: daemon and gateway unit tests with a synthetic 146-character
project key (save → `key.json` → read back, shown suffix, stored plain key);
`speech-project-key-update.json` contract example plus negative dotted cases;
`speech-input.spec.ts` now saves a project-shaped personal key and checks that
the daemon mints with it (administrator's key stays plain). Review: focused
self-review; the change is the shape rule only.

## Decisions for later review

- **How wide the dotted shape is.** Chosen: at most four dot-joined runs,
  no empty run, total 16–256, last run ≥ 4. Alternatives: require the literal
  `snx_proj_` prefix and the 43/86/6 segment lengths (breaks if Soniox
  changes lengths), or simply add `.` to the character class (allows `...`
  and a suffix with a dot, which the suffix contract `^[A-Za-z0-9_-]{4}$`
  refuses). The last-run rule keeps the four-character suffix dotless.
- **Length bound moved out of the regex** into `minLength`/`maxLength` and a
  length check, because RE2 (Go) has no lookahead to bound a dotted pattern.
