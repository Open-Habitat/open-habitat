---
created: 2026-09-21
updated: 2026-10-03
type: task
status: open
priority: normal
epic: native-agent-host-architecture
lane: ui-v1
lane_seq: 70
blocked_by: ['@complete-conversation-ui']
collision: [docs/, AGENTS.md, design-system/]
---

# Manage local workspace lifecycle

Let users create, configure, hide, restore and delete local workspaces discovered
under `~/src`, while preserving the filesystem and native tools as the source
of truth.

The [workspace handoff](https://github.com/maintainer/native-agent-host/blob/0d1a53160772be64daa00879536c8103bbd3d0e1/design-system/drafts/v1/workspaces/AGENTS.md)
describes the accepted experience. Agreed [product behavior](../../docs/product.md),
[interfaces](../../docs/interfaces.md) and
[production design](../../design-system/design.md) carry its subsequent
decisions. The [implementation map](../plan-v1-implementation/implementation-briefs.md)
separates this issue from GitHub integration and Taskfleet worktree management.

## Expected behavior

- Create a workspace using the accepted directory-name rules, with optional
  `git init`; Git can also be enabled later. Preserve the accepted opening,
  first-agent and focus behavior. Repository integration before opening a Git
  workspace belongs to @connect-github-workspaces; until verified, show its
  capability as unknown rather than claiming it is available.
- Read and edit the display name without renaming the directory. Show Git,
  branch and remote facts from Git rather than storing copies.
- Hide and restore workspaces as presentation preferences, without deleting
  their directories or stopping their agents.
- Offer deletion with the exact directory-name confirmation and a preview of
  affected processes, worktrees and other effects. Keep “Hide instead” available.

A workspace exists without metadata or a registry. Workspace-local
`.agent-host/workspace.json` holds only the schema version, stable ID and
optional display name. Hidden state belongs in the user's XDG presentation
state, keyed by stable ID. Both stores use atomic writes; corrupt or unknown
metadata remains visible as a warning and is not silently overwritten.
Native data remains readable. Follow the interface's annotation contract and
the architecture's local Git-exclude preference.

## Safe mutation and truthful outcomes

Native mutations run in the user's daemon. Descriptor-relative, no-follow
operations and target revalidation keep changes within the intended workspace,
including when paths are replaced during an operation. Traversal does not cross
mount boundaries.

Deletion confirmation matches the directory name exactly, including case and
whitespace, and its observation token binds it to the same filesystem target.
A mismatch or stale target permits no process, worktree or directory mutation.
Preflight includes linked worktrees outside `~/src`. Unowned processes,
unobservable effects and unsafe targets block deletion. Managed processes stop
through their owner, with exit and settled history verified. Taskfleet removes
its own worktrees; until @manage-agent-worktrees verifies that adapter, its
worktrees are unknown effects and block deletion. Manual or unknown worktrees
remain read-only and block destructive cleanup.

Operations expose their actual stages and residual effects. A later failure
does not undo an earlier success. Browser disconnect does not cancel a host
operation; reconnect reconciles its result with fresh native observations.
Retry requires fresh observations, and deletion is complete only after the
source listing confirms absence, with any remaining cleanup reported as partial.

## Evidence and delivery

Verify successful flows, duplicate names, permissions, disconnects and partial
failures using disposable data. Cover symlink, replacement, mount, process and
worktree races, plus crashes at each mutation stage and atomic metadata recovery.
The assigned contract scenarios are CT-016, CT-017, CT-020, CT-024 and CT-029;
[TESTING.md](../../TESTING.md) describes the current checks.

Record the tested revision, commands, outcomes and remaining limits in
`result.md`. Keep affected durable documentation and component examples current;
issuectl owns task state.

Use shared production components for controls, interaction, focus and styling.
Retire superseded canonical mocks when their production replacement lands;
originals may remain in their receiving issue as historical evidence.
Save proportionate browser evidence in `visual-acceptance.md` as synthetic-lab
screenshots paired with static HTML snapshots, identifying the revision. Record Jari's verdict when given.
Unreviewed appearance remains unreviewed, without blocking functional completion
or independent downstream work.

## Decisions

### 2026-09-30T17:44:44Z · @claude

Rethink-night 30.9.: käsitelty toteuttajalle suunnattuna ohjeena (rethink-instructions, gpt-6-astra). Selkeytin käyttäjätoiminnot, tiedon omistajuuden, poistoturvan ja näytön; säilytin frontmatterin, hyväksytyn käyttäytymisen sekä visuaalisen arvioinnin keskeneräisyyden. Ilman Jaria valitsin nykyisen rajapintasopimuksen metadatajaon, ei-estävän visuaalikatselmoinnin ja työturvaa suojaavat testit; poistin vanhentuneen M2–M3-viitteen. Faktantarkistus (fact-check-instructions, claude-opus-5-5) korjasi synteettisen labin kuva+HTML-näyttövaatimuksen, erotti GitHub-integraation ja Taskfleet-adapterin myöhempien issueiden omistukseen sekä täsmensi tuotekuvauksen hyväksytyksi, ei jo toteutetuksi. Paikallisesti tarkistettu web/AGENTS.md, TESTING.md, docs/interfaces.md, docs/product.md, implementation-briefs.md ja issuectl show. Avoin asiakirjojen ristiriita: docs/product.md sanoo piilotuksen olevan muuttamatta työtilan tiedostoja, docs/interfaces.md vaatii ensin vakaan ID:n, mikä metadataa vailla olevassa nykyisessä daemonissa saattaa vaatia asetustiedoston kirjoitusta; en ratkaissut Jarin puolesta enkä muuttanut tätä kohtaa. Faktantarkistuksen epävarmuudet: CT-016/029:n clone-osan omistus ja työtilan asetustiedoston atomisen kirjoituksen lähde; edellinen teksti edellytti atomisuutta. En löytänyt tässä issuessa erikseen kirjattua Jarin päätöstä, jota olisi muutettu.
