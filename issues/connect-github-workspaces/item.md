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

Connect repository creation and cloning to the workspace UI so people can work
with GitHub using their mapped Unix account. Local workspace creation and
settings belong to @manage-workspace-lifecycle; this issue owns the GitHub
integration and the [native GitHub assumption](../../docs/assumptions.md#githubin-natiivi-käyttö-kirjautumisen-jälkeen).
The [implementation map](../plan-v1-implementation/implementation-briefs.md)
assigns CT-018, CT-032 and CT-034 here. The
[design](../../design-system/design.md) describes repository choosing and account
connections. All repositories are visible by default; time filtering is the
user's choice. Creation, origin setup and push have separately observable results.

Git and GitHub remain authoritative for repository state. Use the mapped user's
native `gh` and Git configuration rather than a browser secret upload or a
persistent gateway credential broker. The accepted authentication and credential
boundary is recorded in [the implementation review](../plan-v1-implementation/review.md)
(section 6); follow the current [interfaces](../../docs/interfaces.md) and
[contract scenarios](../../contracts/v1/scenarios.json) for operation semantics.
Web logout preserves native Git continuity; explicit disconnect removes local
`gh` authorization but does not revoke the token or OAuth grant on GitHub.

## Expected behavior

- Detect usable GitHub authorization for the mapped Unix user without revealing
  credentials to the browser. Unavailable actions and failures need actionable
  explanations.
- Create a GitHub repository from a local Git workspace with explicit visibility.
  CG-03 requires exact `owner/repository` confirmation tied to a fresh
  observation. Remote creation, origin setup and ordinary HTTPS push have
  independently observable outcomes; a later failure does not erase an earlier
  success.
- Reuse the existing native GitHub repository catalog, exact-reference checkout
  and `GitHubRepoChooser` component in the workspace UI. The existing clone path
  already checks duplicate destinations and Unix-user/path boundaries; this
  issue connects that path to the workspace flows rather than building another
  clone backend. A text search would need client filtering or a contract change.
- Handle authorization denial, network errors and partial Git/GitHub effects
  without implying that an uncertain operation succeeded or silently retrying
  it as a new mutation.

## Evidence and delivery

Cover the happy paths and relevant denied, duplicate, partial and cross-user
cases with deterministic fixtures. Jari's accepted proof replaces a broad
live two-user GitHub permission campaign with one authorized **private,
disposable** repository smoke from the mapped daemon environment: create,
origin, ordinary HTTPS Git push, clone/pull and verified deletion. The
[implementation review](../plan-v1-implementation/review.md) records the precise
security and proof boundaries. Use the foundation's executable checks and the
current [testing policy](../../TESTING.md).

Save `result.md` here with tested revision, commands, outcomes and remaining
limits, distinguishing fixtures from the live proof. Provide proportionate
browser evidence and essential screenshots from the synthetic lab in
`visual-acceptance.md` with the revision, environment and relevant outcomes. Record Jari's visual verdict when
given; unreviewed appearance remains unreviewed. A pending screenshot verdict
does not block functional completion or independent downstream work.

Interactive and repeated behavior must use the shared production component implementation. Local composition may arrange one-off content but may not invent controls, state semantics, focus rules or styling. When this production slice replaces a canonical/root mock or static reference, remove the superseded root/canonical reference in the same accepted change; an original may remain only in its receiving issue as historical evidence.

Update affected durable documents and component examples alongside the work.
Issuectl owns task state; `TODO.md` is not a second progress record.

## Decisions

### 2026-09-30T17:37:53Z · @claude

Rethink-night 30.9.: rethink-instructions; vaiheen 1 malli gpt-6-astra ja faktantarkistuksen malli claude-opus-5-5. Ilman Jaria valitsin toteuttajaohjeen tiivistämisen tarkoitukseen, natiivin gh/Git-rajan ja testinäytön säilyttämisen sekä myöhemmän kuvaporttipäätöksen soveltamisen. Faktantarkistus poisti vanhentuneet M4/A6-tunnukset (A6 tarkoittaa designissa muuta), erotti jo toteutetun katalogin ja kloonauksen tämän työn luonti-/push-kytkennästä, täsmensi paikallisen gh-uloskirjautumisen ja GitHub-pään revokaation eron, lisäsi v2-designin sekä Jarin oletussuodatuspäätöksen ja rajasi kuvat synteettiseen labiin. Aiempi testing-kuvaportti on myöhemmällä päätöksellä poistettu; ei uutta ristiriitaa Jarin voimassa olevaan päätökseen. Frontmatter ja ajastus jätettiin ennalleen.
