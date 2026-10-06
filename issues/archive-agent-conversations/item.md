---
created: 2026-09-21
updated: 2026-10-06
type: task
status: done
priority: normal
epic: native-agent-host-architecture
lane: ui-v1
lane_seq: 85
preparation: ready
collision: [docs/, AGENTS.md, design-system/]
closed: 2026-10-06
closed_by: claude
---

# Archive native agent conversations

Let users archive a daemon-managed browser conversation whose idle or ended
state can be confirmed, find it in its workspace's archive, restore it and
deliberately continue it with the same native Pi history and `pi:<sessionId>`.
Archiving changes only presentation; history stays where Pi keeps it. Terminal
histories remain readable but cannot be archived in this slice because their
process state cannot currently be established.

## Scope and existing foundations

This issue owns the archive journey and CT-021 in the
[implementation map](../plan-v1-implementation/implementation-briefs.md).
Use the per-user [annotation schema](../../contracts/v1/annotations.schema.json)
for archive state, grouped by workspace in the UI. The schema exists, but archive
persistence and the snapshot's archive field remain to be implemented along with
the daemon and browser behavior. This does not introduce a workspace-local
archive store or a transcript copy.

[Agent control](../build-agent-control/item.md) delivered the control and
continuation path. [Conversation architecture](../../docs/architecture/conversations.md)
explains its ownership checks and single-writer protection. Build on that path:
readable history does not establish control or prove that a terminal process
has ended.

## Behavior and its reasons

Stopping, archiving, restoring visibility and continuing have separate outcomes.
The conversation leaves the active list after the archive annotation succeeds.
Continue restores visibility before attempting native continuation, so a failed
resume leaves the successful restoration visible. Restore alone starts no Pi
process and does not focus a read-only editor.

A daemon-managed conversation that is idle or confirmed ended can be archived;
an active writer produces `writer_conflict`. Unknown process state does not
establish eligibility. Terminal histories have no proven process state today,
so they remain outside this archive journey. Process stop is available only for
runtimes the daemon owns and can control. Pi's `abort` interrupts a turn, and
`agent_settled` marks a turn boundary; neither proves process exit. The current
stop action returns `termination_unknown`. Its acknowledgement alone cannot
justify archiving or starting another writer: Pi permits competing runtimes on
the same session, and detached tools may outlive its process. Browser disconnect
also leaves Pi running.

An unavailable source, missing history or unreadable annotations is not an empty
archive. Annotation failure leaves native history accessible and the presentation
state visibly uncertain; corrupt bytes remain available for diagnosis. Likewise,
a stale view or lost response leaves an action uncertain until its actual outcome
can be established.

## UI and evidence

Use the shared [production components](../../design-system/components.md) and
[design](../../design-system/design.md), including an archive-conflict example.
These sources describe the common UI but currently contain no archive-specific
route or ArchiveDialog contract.
Keep application behavior and component examples aligned as the archive UI is
added, and retire any canonical mock it replaces.

Demonstrate CT-021 with disposable native history: archive, restore and continue
the same session. Focus failure coverage on writer conflicts, stop/resume
failures, interrupted or corrupt annotation writes, missing history and stale or
disconnected views. Follow [TESTING.md](../../TESTING.md), record evidence and
limits in this issue's `result.md`, and update affected documentation and examples.
Browser screenshots and outcomes belong in `visual-acceptance.md`; Jari's visual
verdict remains separate from functional completion.

## Acceptance Criteria

- [x] CT-021 archive → restore → same-ID continuation and the refusal/uncertainty cases are verified in disposable fixtures; evidence and limits are in [the result](result.md).

## Decisions

### 2026-09-30T17:36:29Z · @claude

Rethink-night 30.9.: toteuttajalle suunnattu issue kirjoitettiin rethink-instructions-skillillä (gpt-6-astra); faktantarkistus fact-check-instructions-skillillä (claude-opus-5-5). Ilman Jaria valittiin nykyinen käyttäjäkohtainen annotaatiosopimus, saman Pi-ID:n jatkaminen, erilliset stop/arkistointi/palautus/resume-toimet ja terminaalihistorian varovainen vain luku -tulkinta; visuaalinen arvio jää ei-estäväksi. Faktantarkistus korjasi väitteen jo toteutetusta annotaatiosta (toteutus ja snapshotin arkistokenttä puuttuvat), erotti daemonin epävarman prosessipysäytyksen Pi:n abortista ja täsmensi ArchiveDialogin olevan vielä rakennettava. Ristiriitaa Jarin kirjattuun päätökseen ei löytynyt. Avoin sopimustulkinta: tuntemattoman prosessitilan terminaalihistoriaa ei pidetä idle-/päättyneenä ilman näyttöä; mahdollinen säännön löysennys tarvitsee erillisen päätöksen, eikä sitä tehty yöllä.

### 2026-10-05T12:42:27Z · @jari

First archive implementation is limited to daemon-managed browser conversations with a verifiable idle or ended state. Terminal history remains readable but is not archivable in this slice because its process state is currently unknown.
