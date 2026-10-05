---
created: 2026-09-21
updated: 2026-10-05
type: task
status: open
priority: normal
epic: native-agent-host-architecture
lane: ui-v1
lane_seq: 80
blocked_by: ['@manage-workspace-lifecycle']
collision: [docs/, AGENTS.md, design-system/]
preparation: pending
---

# Connect GitHub workspace flows

People can bring a GitHub repository into their workspaces and publish a local
Git workspace to GitHub using their mapped Unix account. Local workspace
creation and settings belong to @manage-workspace-lifecycle. This issue connects
GitHub creation, cloning and native authorization to those workspace flows.

Git and GitHub own repository state; the user's native `gh` and Git configuration
own credentials. The [identity architecture](../../docs/architecture/identity-and-trust.md)
describes the existing login handoff and why credentials stay out of the browser
and persistent gateway storage. Web logout preserves native Git access. Explicit
disconnect removes local `gh` authorization, without claiming to revoke the token
or OAuth grant on GitHub.

## Behavior and existing foundation

Publishing asks for repository visibility and exact `owner/repository`
confirmation tied to a fresh observation (CG-03 / CT-032), so the approved target
is the one acted on. Remote creation, origin setup and ordinary HTTPS push have
separate outcomes: a failed push leaves a successfully created repository real
and visible. Authorization denial, network failure and uncertain results tell
the user what is known and how to proceed. Retrying depends on fresh native
observation, since repeating an uncertain mutation can duplicate its effects.

The native repository catalog, exact-reference checkout and `GitHubRepoChooser`
already serve onboarding. The [workspace architecture](../../docs/architecture/workspaces.md)
and `web/src/app/GitHubOnboarding.tsx` describe that foundation, including clone
progress, duplicate destinations and user/path boundaries. Extend its use to the
workspace UI. Repository selection follows the [design](../../design-system/design.md):
all repositories are visible by default, with time filtering chosen by the user.
The catalog has no text-search parameter; search needs client filtering or a
contract change.

The [contract scenarios](../../contracts/v1/scenarios.json) define partial
results (CT-018), exact confirmation (CT-032), native disconnect (CT-034) and
clone progress/recovery (CT-036). The disconnect contract includes fresh
reauthentication and observed local auth absence before reporting success.
Shared production components and the [design process](../../design-system/process.md)
keep these flows consistent with the rest of the application; replacing a
canonical mock also retires that superseded reference so it cannot compete
with the current design.

## Evidence

Deterministic fixtures cover successful, denied, duplicate, partial and
cross-user cases. Jari's [accepted proof boundary](../plan-v1-implementation/review.md)
(section 7) adds one authorized private, disposable repository smoke from the
mapped daemon environment: create, origin, ordinary HTTPS push, clone/pull and
verified deletion. This proves native integration; GitHub and `gh` own ordinary
permission semantics, so a broad live two-user permission campaign adds no
required proof.

Record evidence and remaining limits in `result.md`, distinguishing fixtures
from live proof, under [TESTING.md](../../TESTING.md). Synthetic-lab browser
evidence belongs in `visual-acceptance.md`; Jari's visual verdict remains
separate from functional completion, as described in
[the working agreement](../../AGENTS-WORKFLOW.md). Updated durable documentation
and component examples describe the delivered behavior.

## Decisions

### 2026-09-30T17:37:53Z · @claude

Rethink-night 30.9.: rethink-instructions; vaiheen 1 malli gpt-6-astra ja faktantarkistuksen malli claude-opus-5-5. Ilman Jaria valitsin toteuttajaohjeen tiivistämisen tarkoitukseen, natiivin gh/Git-rajan ja testinäytön säilyttämisen sekä myöhemmän kuvaporttipäätöksen soveltamisen. Faktantarkistus poisti vanhentuneet M4/A6-tunnukset (A6 tarkoittaa designissa muuta), erotti jo toteutetun katalogin ja kloonauksen tämän työn luonti-/push-kytkennästä, täsmensi paikallisen gh-uloskirjautumisen ja GitHub-pään revokaation eron, lisäsi v2-designin sekä Jarin oletussuodatuspäätöksen ja rajasi kuvat synteettiseen labiin. Aiempi testing-kuvaportti on myöhemmällä päätöksellä poistettu; ei uutta ristiriitaa Jarin voimassa olevaan päätökseen. Frontmatter ja ajastus jätettiin ennalleen.
