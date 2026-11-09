# Result

The workspace page's Arkisto is direction 1 Lista of `proto-conversation-archive`:
grouped by archiving day, newest first, dated rows, a title filter, helper and
worker marks on the row, a quiet ↺ restore and a status line once the host
confirms it. An archived conversation opened from the list shows a foot in the
composer's place: when it was archived, its helpers (production
`HelperArchiveRows` with Avaa haara) and Palauta. The snapshot carries
`archived_at` from the person's own archive mark (optional field in
`contracts/v1/snapshot.schema.json`).

Evidence (synthetic lab, device scale 2): `evidence/a-<fi|en>-<step>-<1440|390>-<light|dark>.avif`,
steps `0-default`, `1-filter`, `2-read`, `3-explain-T42…T45` (1440 light),
`4-restored`; `a-fi-0-default-1440-light.html` is the static twin. The lab now
seeds aurinkokello with the thirteen archived titles of Jari's report
(`test/browser-host/lab_archive.go`); the capture script is
`web/lab/capture-conversation-archive-list.mjs`.

## Decisions for later review

- **The archive stays behind its fold (Arkisto · 13).** Alternative: the
  round's always-open section. The fold keeps the page as it was when closed,
  and the per-conversation spinoffs reads run only while it is open (13 reads
  for Jari's archive). The open fold is the round's direction 1.
- **Marks come from the existing per-conversation spinoffs read**, as the brief
  said. Alternative: one workspace Taskfleet read joined by parent id (the
  round's suggestion). Worth doing if archives grow past a few dozen.
- **Workers are counted by how they ended** (*työ yhdistetty*, *2 työtä
  haarassa*, *työ epäonnistui*, *työ käynnissä*); helpers by name, only while
  their run is live and only with the named-workers experiment on. An ended
  helper counts as a worker.
- **A conversation archived before this change has no time** and sinks to the
  end of Vanhemmat without a date. Every archive mark the daemon writes already
  has `archived_at`, so this is only possible for a damaged mark.
- **Aiemmin tällä viikolla means the six days before yesterday**, as in the
  round, not the calendar week.
- **The read view's foot replaces the composer** in both the browser-owned view
  and the read-only history view; its restore has the same availability as the
  header's restore. Worker detail stays in the conversation's own worker cards.
- Explain cards: T42 filter, T43 row, T44 row restore, T45 marks, Y20 foot,
  Y21 foot restore; T14 reworded. E08 (Sulje katsaus) was missing and showed up
  once the coverage check surveyed an archived history view.
