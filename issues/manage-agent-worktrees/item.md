---
created: 2026-09-21
updated: 2026-10-03
type: task
status: open
priority: normal
epic: native-agent-host-architecture
lane: ui-v1
lane_seq: 90
blocked_by: ['@connect-github-workspaces']
collision: [docs/, AGENTS.md, design-system/]
---

# Manage agent worktrees

Make worktree agents first-class agents in Omega Habitat, using Taskfleet
to create and manage their native work. A person should be able to create
work from a Git workspace and use its agent as a natural part of the browser
experience. Jari confirmed this product direction on 3 October 2026.

[Worktree-agent integration design](../decide-taskfleet-browser-integration/item.md)
resolves the browser experience and the launch/control boundary this
implementation needs. Taskfleet's current terminal-agent launch and the
browser's read-only treatment of terminal agents are a gap for that design
to solve.

The [implementation briefs](../plan-v1-implementation/implementation-briefs.md)
identify current ownership. Operation semantics live in
[interfaces](../../docs/interfaces.md) and [contracts](../../contracts/v1/AGENTS.md),
with UI behavior in the [design](../../design-system/design.md).

## Native ownership

Taskfleet creates and removes its worktrees. The host passes its supported
source branch, title and task inputs, then displays the observed result.
Taskfleet determines the final branch name, so the historical mock's promise
of a branch matching the entered name does not apply.

Join Taskfleet ownership to Git and Pi facts using the full run/node identity.
A branch name or display fragment cannot establish ownership. Manual worktrees
and those without a verified ownership match remain read-only impacts and
block destructive cleanup that would affect them. Cleanup of Taskfleet-owned
work goes through Taskfleet so its lifecycle state remains authoritative.

This is a bounded integration with the native lifecycle. A browser-specific
worktree registry or generic Taskfleet control protocol would create a second
authority for work already owned by native tools.

## Expected behavior

- Creation is available for Git main workspaces with a supported Taskfleet
  capability. Explain why it is unavailable otherwise; an unverified adapter
  remains unknown.
- Validate the selected source branch and supported creation inputs before
  invoking Taskfleet. Report the resulting branch and worktree from native
  observations.
- Start the accepted new agent flow only after the worktree identity is available.
  The accepted handoff calls for selecting the new agent and moving focus to it;
  reconcile this with Taskfleet's own agent launch and the browser's read-only
  treatment of terminal agents before promising a writable composer.
- Show the resulting agent under its parent context when that relationship is
  known. Agents without a known parent remain representable.
- Failures and disconnects preserve an honest account of completed effects,
  remaining work and uncertainty. Worktree creation and agent startup can
  have different outcomes.

Use shared production components for controls, repeated interactions, focus
behavior and styling, so the application and component examples demonstrate
the same behavior. Local composition can arrange one-off content. When this
slice replaces a canonical/root mock or static reference, remove that
superseded reference in the same change; the receiving issue can retain the
original as historical evidence.

## Verification and evidence

Exercise successful creation and navigation, a pre-existing branch or path
colliding with Taskfleet's chosen name, dirty state, native-operation failure,
interrupted creation, disconnects and partial teardown with disposable Git,
Taskfleet state and synthetic harness data. Keep the shared tmux server and real
sessions out of destructive test scenarios. Verify
[CT-019](../../contracts/v1/scenarios.json): teardown uses exact Taskfleet
ownership, while manual or unknown worktrees remain read-only and prevent
unsafe cleanup. Use Taskfleet for cleanup of its worktrees.

Follow [TESTING.md](../../TESTING.md) for relevant checks and the final clean
gate. Save `result.md` here with the tested revision, commands, outcomes and
remaining limits; distinguish native integration evidence from simulated
behavior.

Save proportionate browser evidence in `visual-acceptance.md`, with adjacent
screenshots and static HTML snapshots from the synthetic lab, identifying the
tested revision, environment and relevant outcomes; do not use live data. Record
Jari's visual verdict when given. Unreviewed appearance remains unreviewed;
a pending verdict does not block functional completion or independent
downstream work.

Update affected durable documentation and component examples, including the
outdated branch-name promise in `docs/product.md`. Issuectl owns
task status and scheduling; TODO.md is not a parallel task tracker.

## Decisions

### 2026-09-30T17:43:32Z · @claude

Rethink-night 30.9.: toteuttajalle suunnattu issue → rethink-instructions; vaihe 1 gpt-6-astra, faktantarkistus claude-opus-5-5. Ilman Jaria säilytettiin Taskfleetin omistajuusrajat, testit ja näytön vaatimukset; historiallinen M5-merkintä jätettiin pois ja nykyiset sopimuslähteet nostettiin esiin. Faktantarkistus täsmensi synteettisen labin HTML-kuvaparit, testieristyksen, Taskfleetin valitseman haaran törmäyksen ja docs/product.md:n vanhentuneen haaranimilupauksen. Ristiriita: hyväksytty handoff edellyttää uuden worktree-agentin käynnistystä ja fokusta, mutta asennettu Taskfleet käynnistää oman terminaaliagenttinsa eikä selaimen terminaaliagentilla ole kirjoittavaa viestikenttää. Alkuperäinen vaatimus uuden agentin käynnistämisestä vasta worktree-identiteetin jälkeen säilytettiin; toteutuksessa ei luvata kirjoitettavaa viestikenttää ennen arkkitehtuuriratkaisua. Issuectl note päivitti updated-päivän 30.9.:ksi; muut metatiedot säilyivät.
