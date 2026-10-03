---
created: 2026-09-21
updated: 2026-10-03
type: task
status: open
priority: normal
epic: native-agent-host-architecture
lane: ui-v1
lane_seq: 100
blocked_by: ['@manage-agent-worktrees']
collision: [docs/, AGENTS.md, design-system/]
---

# Archive native agent conversations

Let users remove a conversation from the active list, find it in its workspace's
archive and, where browser control is supported, deliberately continue it with
the same native Pi history and `pi:<sessionId>`. Archiving changes presentation;
it does not copy or delete history or create another conversation store.

The [implementation map](../plan-v1-implementation/implementation-briefs.md)
assigns this issue the archive journey and CT-021.
[Agent control](../build-agent-control/item.md) owns the underlying browser
control and continuation path. Build on that implementation and the
[interface contract](../../docs/interfaces.md), which specifies per-user
[annotations](../../contracts/v1/annotations.schema.json) for archive state.
That file is not yet implemented, and the current snapshot agent has no archive
field; deliver the necessary contract and daemon/browser changes as part of this
slice. The archive is presented per workspace, but its metadata is not a new
workspace-local store.

Stopping the managed process, archiving, restoring visibility and resuming are
separate actions with separately visible outcomes. An archived conversation
leaves the active list only after its annotation change succeeds. “Continue”
restores visibility and resumes as distinct stages, so a failed resume does not
conceal a successful unarchive. Restoring visibility alone neither starts Pi
nor moves focus into a read-only editor.

The contract allows archiving an idle or confirmed-ended conversation;
an active writer produces `writer_conflict`. Offer process stop only when the
adapter reports supported browser control over the owned runtime.
The [Pi control probe](../probe-pi-control/result.md) verified turn interruption
with `abort`, not process shutdown. The current daemon's process-stop action
terminates its direct Pi child but reports `termination_unknown`: detached tools
and history settlement are not confirmed. `agent_settled` establishes a turn's
idle boundary, not process exit. Stop alone cannot make archive or another writer
safe while ownership is uncertain; establish the required native facts first.

Pi permits competing runtimes to open the same session. Readable history,
observed process state and owned control are therefore separate facts.
Continuation uses the supported native resume path and the daemon's
single-writer protection; uncertain ownership or unfinished prior work cannot
be treated as permission to start another writer. Terminal histories remain
read-only under the current scope: if a terminal history is archived, it can be
restored to the active list but not continued from the browser. An unknown
process state is not proof that it is idle or ended. Browser disconnect does not stop Pi.

Make failures understandable without losing native facts. Missing history,
unreadable annotations and an unavailable source are different from an empty
archive. Annotation corruption should leave native history accessible, expose
the presentation-state problem and preserve the corrupt bytes. A stale view or
lost response leaves the action uncertain until its outcome can be established.

Build ArchiveDialog in the shared production components to its
[catalog contract](../../design-system/components.md), including the
archive-conflict example. The
[production design](../../design-system/design.md) describes the
archive route, interaction and focus behavior. Application and component examples
share their controls, state semantics and styling, so the examples demonstrate
the delivered behavior. Retire any canonical mock this implementation replaces;
originals may remain in their receiving issue as historical evidence.

Demonstrate CT-021 with disposable native history: archive, restore and continue
the same session without a transcript copy. Cover active-writer conflicts,
stop/resume failures, annotation crash/corruption, missing history and
stale/disconnected views. Record the tested revision, commands, outcomes and
remaining limits in `result.md` here, following
[TESTING.md](../../TESTING.md) and the current
[local checks](../../scripts/AGENTS.md). Update affected durable documentation
and component examples; issuectl remains the source of task status.

Put proportionate browser evidence and screenshots in
`visual-acceptance.md` here, identifying the tested revision,
environment and relevant outcomes. Record Jari's visual verdict when given.
Unreviewed appearance remains unreviewed; it does not block functional
completion or independent downstream work.

## Decisions

### 2026-09-30T17:36:29Z · @claude

Rethink-night 30.9.: toteuttajalle suunnattu issue kirjoitettiin rethink-instructions-skillillä (gpt-6-astra); faktantarkistus fact-check-instructions-skillillä (claude-opus-5-5). Ilman Jaria valittiin nykyinen käyttäjäkohtainen annotaatiosopimus, saman Pi-ID:n jatkaminen, erilliset stop/arkistointi/palautus/resume-toimet ja terminaalihistorian varovainen vain luku -tulkinta; visuaalinen arvio jää ei-estäväksi. Faktantarkistus korjasi väitteen jo toteutetusta annotaatiosta (toteutus ja snapshotin arkistokenttä puuttuvat), erotti daemonin epävarman prosessipysäytyksen Pi:n abortista ja täsmensi ArchiveDialogin olevan vielä rakennettava. Ristiriitaa Jarin kirjattuun päätökseen ei löytynyt. Avoin sopimustulkinta: tuntemattoman prosessitilan terminaalihistoriaa ei pidetä idle-/päättyneenä ilman näyttöä; mahdollinen säännön löysennys tarvitsee erillisen päätöksen, eikä sitä tehty yöllä.
