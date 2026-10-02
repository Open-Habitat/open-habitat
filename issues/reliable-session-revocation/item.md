---
created: 2026-10-01
updated: 2026-10-02
type: task
status: wontfix
priority: normal
provenance: ai-review
source_ref: taskfleet:01m3wbw6e29bqam9d1pt6hdxtz/review-finding:sha1:c82729306ec36720983fe1e6520b52106ebc51ff
review_source: ai-review
originating_run: 01m3wbw6e29bqam9d1pt6hdxtz
originating_run_kind: spinoff
labels:
- ai-review-model:claude-fable-5-1
- ai-review-model:gpt-6-astra
assessment_classification: CONFIRMED
assessment_outcome: SPIN_OFF
review_confidence: high
review_severity: high
review_target: 5199976^..5199976
closed: 2026-10-02
---

# Make targeted session revocation reliable across admission changes

## Disposition

Jari agreed on 2026-10-02 to close this extension as unnecessary for the current
scope. Targeted revocation originated in a one-off test-account reset; current
test use can reset the entire environment. A general operator action to remove
one person's web access has no current product requirement.

Keep the existing implementation and ADR 0006 authority unchanged. This issue
does not add broker operations, remove broker authorization from revocation,
or interrupt already-admitted event streams. If targeted removal becomes a
product need, design its admission and session behavior together then.

## Known limitation

`RevokeSubject` asks the broker to authorize the subject before deleting the
gateway's sessions. Removing admission or stopping the daemon socket first
can therefore make targeted revocation fail. Revoke-before-edit also leaves
a race in which a new login can occur between those operations. Already
admitted requests and streams are not interrupted by revocation.

The review finding is real; closing this issue accepts the limited scope of
the existing mechanism rather than claiming that these cases were fixed.
See [ADR 0006](../../docs/adr-0006-subject-revocation.md).

## Decisions

### 2026-10-02T03:16:51Z · @jari

Keskustelussa 2026-10-02 Jari kyseenalaisti käyttötarpeen ja hyväksyi suosituksen sulkea jatkoissue nykyisessä laajuudessa tarpeettomana. Olemassa oleva toteutus ja avoimien tapahtumayhteyksien käytös säilyvät. ”ok. Jatketaan näillä”.
