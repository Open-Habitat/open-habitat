# Result

Reading a named reply no longer hands its rail position to a background process
or worker. It stays in Sinun vuorosi with the read mark. A new working turn
supersedes the previous reply in both read and unread states, including its
marker. Ei nyt is available while background work continues: it releases the
reply to Käynnissä without stopping that work. Quiet conversations still go to
Hiljaiset. Finnish/English action copy and Explain card S33 reflect both cases.

The rail's section lists, hints/counts, next-waiting navigation and mobile badge
share this model, including the sidebar on home and return pages. HomeWorkspaces
and ReturnView also have independent unread-news card grouping; those cards are
not the rail model and were not redesigned. Seen attention is browser-local;
the daemon persists reply-scoped turn marks, not a seen-based rail section.
No daemon or contract changes were needed. heldStatus, old background-service
classification and crash/cut/failure rules are unchanged.

## Validation

- Focused web check: 216 files, 1,679 tests passed, plus lint/typecheck/catalogs.
- railNow table: nothing live, waiting background process, busy worker, idle
  worker, and working then settled. Checks unchanged section and hints on
  reading, read/unread marks, Ei nyt, person reply and a new working turn.
- 17 host-backed synthetic browser tests passed: rail-groups, rail-unread,
  rail-now, rail-running-after-done, rail-turn-returns, rail-interrupted-turn,
  rail-hover-marks and workspace-count-rail. Includes keyboard opening while a
  current-turn process wait remains live, then Ei nyt into Käynnissä.
- Four synthetic lab tests passed at 1440/390 CSS pixels in Finnish/US English:
  S33 maps to the action and Explain mode blocks its lasting effect. The paired
  `explain-*.png`/`.html` captures were inspected: card fits and text is readable.
  UK uses the same text. No real installation was captured or tested.
- UI-reference generation and its check passed; regeneration also exposed broad
  pre-existing checked-in reference drift. Generated outputs were restored, not
  mixed into this fix; release packaging regenerates the guide from source.

## Review

Focused self-review plus claude-fable-5-2 finder and gpt-6-astra verifier.
Both confirmed two concrete consequences, fixed here: the superseded unread
marker during work and missing Ei nyt on retained live replies. The verifier
also identified the obsolete promise that Ei nyt always moves to Hiljaiset;
the copy and synthetic visual checks above cover it. Review/assessment working
artifacts live under ignored history/, not as dependencies of this result.

## Decisions for later review

- Use an actual working turn, not background liveness, to supersede a reply.
  Simply removing the live guard would also retain old replies during the next
  turn, breaking the existing re-read hold test. The guard applies equally to
  new/read attention and to the unread marker.
- Let Ei nyt release a reply even while background work remains live. Keeping
  the old action gate would trap the newly retained read reply until the work
  ended. This changes no process and uses the existing daemon mark operation.
- Preserve non-reply event/history attention semantics. The reviewer noted that
  new attention without last_reply can still clear on reading; treating every
  stale seen marker as a reply would revive removed replies, while requiring a
  reply for all new attention would hide existing unseen error attention. The
  brief explicitly preserves failure/cut/crash rules, so this is a named-reply
  placement fix, not a redesign of event attention or worker turn ownership.

Live check: open an unread reply in Sinun vuorosi while its background process
or worker remains live. It should stay in Sinun vuorosi, gain the read mark,
and retain the same badge count. Ei nyt should move it to Käynnissä without
stopping the work; sending another message should show a working marker.
