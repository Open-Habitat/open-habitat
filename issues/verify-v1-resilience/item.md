---
created: 2026-09-20
updated: 2026-10-03
type: task
status: open
priority: normal
epic: native-agent-host-architecture
lane: ui-v1
lane_seq: 120
blocked_by: ['@archive-agent-conversations', '@complete-conversation-ui', '@prepare-mvp-operations']
collision: [docs/, AGENTS.md, design-system/]
---

# Verify reconnect and two-user separation for v1

Make the delivered desktop experience reliable enough for real use, with evidence
of recovery and user isolation that guides focused fixes and the next feature.
This work produces evidence and fixes, not a final MVP acceptance checkpoint.

## Behavior to establish

Browser or gateway loss leaves the daemon-owned Pi process running. Reconnection
recovers through SSE replay or a fresh snapshot without duplicate messages.
A send interrupted before acknowledgement remains uncertain until reconciled;
it is not automatically resent.

Daemon failure has different guarantees: an active turn need not survive.
Recovery reconciles native history and process evidence before allowing another
writer, including uncertainty about detached tools. Stale observations and missing
native sources produce visible, recoverable states rather than invented success.

Two distinct Linux accounts remain separate across routing, native access,
snapshots and events, including attempts to reach the other user's resources.
Independent SSH, tmux and native Pi use remains possible. Terminal histories are
read-only in the browser; opening one neither takes over the terminal nor starts
another writer.

Exercise the delivered workspace, GitHub, worktree and archive flows through
partial failures and recovery. Verify package update and rollback, including
preservation of native data, where the environment can establish those claims.
Measure realistic long-history and streaming workloads and adjust useful limits
from the results.

## Approach and boundaries

Use the current [architecture](../../docs/architecture.md),
[implementation map](../plan-v1-implementation/implementation-briefs.md),
[contract scenarios](../../contracts/v1/scenarios.json) and feature results to
select integration checks. [TESTING.md](../../TESTING.md) describes executable
checks and what their evidence proves. The
[delivery plan](../plan-v1-implementation/plan.md) records the historical direction;
[production design](../../design-system/design.md) is the current design.
The [design package](../native-agent-host-architecture/ui-design-package.md) and
[conversation brief](../native-agent-host-architecture/ui-design-conversation.md)
provide earlier design context.

Native components retain their histories, configuration and subprocess ownership.
Recovery follows the agreed HTTP/SSE contracts, including the separate onboarding
clone cancellation behavior. Verification does not introduce a workspace registry,
parallel history store, credential broker, internal tenant model or speculative cache.

Use two synthetic Unix users and disposable native data for automated isolation
tests. Browser fixtures using one UID cannot establish Linux account separation.
Live participants sign in themselves; technical verification does not depend on
a second person's participation. Live checks follow Fleetrepo's current
`infra/native-agent-host-test/` documentation (including `RELEASE-UPGRADE.md`
for updates and switch-back) and the pilot procedure from @prepare-mvp-operations.

## Results and follow-up

Save plans and evidence in this issue directory, with `result.md` identifying the
tested revision, commands, outcomes and remaining limits. Distinguish synthetic
evidence from live-host evidence and leave untested behavior explicit.

Carry findings through focused fixes and review. Update affected durable
documentation and component examples; issuectl owns task state.

Walk through desktop v1 with Jari and record remaining defects and the observed
need for the next feature. Pending feedback remains pending without blocking
technical verification or independent work.

## Decisions

### 2026-09-30T17:57:09Z · @claude

Rethink-night 30.9.: rethink-instructions / gpt-6-astra tiivisti toteuttajalle osoitetun issuen tavoitteiksi, rajoiksi ja näytöksi. Ilman Jaria valitsin säilyttää kaksikäyttäjäeristyksen, epävarman lähetyksen ja natiivin omistajuuden rajat sekä Jarin työpöytäkatselmoinnin palautteena, ei teknisen todentamisen porttina; synteettiset eri UID:t eivät korvaudu yhden UID:n selainfixtuureilla. fact-check-instructions / claude-opus-5-5 tarkisti lähteet: tarkensin live-ohjeen kattamaan Fleetrepon asennusdokumentaation ja @prepare-mvp-operations-pilottiohjeen pelkän release-runbookin sijasta, nimesin production-v1.md:n nykyiseksi designiksi ja vanhat briefit taustaksi sekä päivitin muokkauspäivän. Jarin kirjattuihin päätöksiin ei löytynyt ristiriitaa. Live-kahden käyttäjän näytön saatavuus ja uuden Fleetrepo-operaattorin hyväksyntä jäävät erikseen todennettaviksi; niitä ei tulkittu tässä hyväksytyiksi.
