# Result

Toistaiseksi (`days: 0`) is the default for a new machine and for *Uusi pääsy*.
The line is `restrict,from="…"` with no `expiry-time=`; the grant and the saved
machine carry `expires: ""` and are never expired. 7, 30 and 90 days stay and
keep their dates.

## Decisions for later review

- **Wire encoding of "no end".** `days: 0` in the request, and an empty
  `expires` in the grant, the machine and save/extend. Alternatives: omitting
  `days`/`expires`, or `null`. Chosen because the schema already uses `""` for
  an absent host key, the decoder's exact-key check stays as it is, and `null`
  is now refused outright (it would decode as no end without being asked for).
- **Machine file.** An indefinite machine's marker has no `expires=` field
  rather than `expires=never`; older dated files read as before.
- **Wording.** Card: *Pääsy: voimassa, kunnes perut*; dialog note under the
  choice: *Pääsy on voimassa, kunnes perut sen koneellasi.*; the three
  sentences say *on voimassa, kunnes perut sen*; the remove confirmation says
  the machine accepts the line *kunnes poistat sen*. The renewal save button is
  *Tallenna* without a date and *Tallenna uusi päivä* with one.
- **OpenSSH 8.2 note** (Windows step 3 and the key-rejected hint) appears only
  when a date is chosen, since only `expiry-time=` needs 8.2.

## Review

Independent `/llm-review` (finder gpt-6-astra, verifier claude-fable-5-1 on
the grant-duration boundary): no confirmed findings.
