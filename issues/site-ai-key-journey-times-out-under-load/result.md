# Result: site-ai-key journey under load

No product fault: the journey simply did too much for one 30 s test. It
is now two tests, split where its two behaviours meet:

- *an administrator gives the key to people who joined earlier*: the
  review dialog (one word per person, Alice's own key never offered, axe),
  the give, Bob's native copy and his settings row.
- *a new site key replaces the given copies and never a person's own key*:
  the replacement through the page, Bob's copy replaced, Alice's own key
  kept, Bob's row still the site's, Käyttäjät ja pääsy's *annettu* and the
  page on a phone.

Both start from a shared helper. Bob joins, Alice signs in, and the site
key and Alice's own key are written through the same browser API the
pages use (`ai-key/set`, `pi/credentials`). The replacement test gives
Bob's copy through `ai-key/seed`, as the dialog does. Storing the key
through Käyttöönotto's AI step is already walked by the spec's first two
tests, so these two no longer repeat it.

## Evidence

Durations under four `yes` processes, two workers:

| case | before | after |
|---|---|---|
| old combined journey | 16.0–16.8 s | — |
| gives | — | 9.7–10.4 s |
| replaces | — | 11.3–12.1 s |

The whole spec `--repeat-each 5` under that load passed 20/20; alone it
passed 4/4 (7.9 s and 9.4 s).

## Decisions for later review

- **Setup through the API instead of the UI in the two split tests.** The
  alternative was to keep `storeKey` (the Käyttöönotto route and the AI-avain
  form) in both, which would cost most of the time saved. The form and route
  stay covered by the first two tests.
