# Result: administrator before first sign-in

## What landed

- **Gateway** (`internal/gateway/designation.go`): a second role source
  beside root's site.json, the way `site_admin` admission sits beside
  `operator` admission. A current administrator designates an admitted
  GitHub id (`POST /api/v1/server/access/role {id, administrator}`); the
  record (`designated_administrators`: id, actor, at) lives in the gateway's
  administration state. A bound id is granted at once; any other is granted
  by `grantPendingLocked` at the sign-in whose broker recheck confirms that
  id's binding, the same point root's `pending_administrators` are granted.
  Revoke removes a designation, pending or granted, and the role ends at
  once. A site.json role is `operator_owned` and never revocable here.
  A root `role`/`role_declared` on a designated id takes it over.
  Withdrawal that deletes a never-used admission drops its pending
  designation; one whose admission root removed is listed as `unlisted`.
  A denied subject no longer counts as administrator anywhere (review F1).
- **Host apply** (`internal/host/apply_control_linux.go`): `convergeRoles`
  removes only root-given roles site.json no longer makes, leaves
  designations alone, and re-grants a declared id that is designated so
  root takes it over. `administrationMatches` (apply readback and upgrade)
  neither requires nor refuses designations.
- **Contract**: `server-access.schema.json` gains `role_request`, the
  `administrator_role` entry field (source operator/site_admin, state
  pending/granted), state `unlisted` and refusal `not_admitted`.
- **UI**: Käyttäjät ja pääsy rows offer *Tee ylläpitäjäksi* (with a
  confirmation saying the role belongs to the GitHub id, not the name) and
  *Poista ylläpitäjyys* for designations; a pending designation reads
  *Ylläpitäjä ensimmäisestä kirjautumisesta*.
- **CLI**: `admin settings show` lists `designated_administrators`;
  `admin access list` carries `administrator_role`.
- Rule moved into `internal/AGENTS.md`; ADR 0030 notes the supersession.

## Tests

- `go test -race ./internal/gateway` (new `designation_test.go`: pending,
  revoke while pending, renamed login gains nothing, grant at first sign-in,
  persistence, immediate grant and revoke for a bound person, root takeover,
  admission removal, unlisted, bare deny, withdrawn administrator holds no
  authority), `./internal/host`, `./internal/cli`.
- Contracts focused check; web unit/component checks.
- Browser: `web/tests/server-access.spec.ts` with a new case: name Bob
  before his first sign-in, revoke while pending, name again, Bob signs in
  and is administrator, revoke ends it (the synthetic broker gained
  `/fixture/access?unbound=43`).

## Review

Independent `/llm-review` at critical rigor (finder gpt-6-astra, verifier
claude-fable-5-1) plus `/assess-findings`: two confirmed findings, both
fixed with tests (a withdrawn administrator's in-flight request kept
authority; a revoke reply could hide a bare deny until reload).

## Decisions for later review

- **Bind to the numeric GitHub id, never the login.** The browser resolves a
  login with the existing lookup and admits by id; the designation is made
  on that admitted id. Alternatives: store the login and resolve at sign-in.
  Rejected: a renamed or reused login would inherit the role.
- **A designation requires an open admission row** (allowed or joined, not
  denied). Alternatives: designate any id, or let designation also admit.
  Chosen so that the role path cannot admit anyone and every designation
  sits on a visible row. Consequence: in admission `any` mode a person who
  is not on any list cannot be pre-named; site.json remains the route there.
- **Browser administrators are peers for designations** (open question (b)):
  any current administrator may revoke any designation, including the one
  that made them, but never a site.json role. Alternatives: only the
  designating administrator may revoke; or the browser may revoke any role.
  Chosen to mirror admission, where `site_admin` entries are revocable and
  `operator` ones are not.
- **Host apply leaves designations alone** (open question (a)); declaring a
  designated id in site.json makes the role root's. Alternative: apply
  removes every role site.json does not declare. Rejected: it would undo a
  browser designation on the next apply.
- **Granting needs a confirmation dialog, revoking does not**: granting adds
  authority, revoking only removes it.
- **Withdrawal keeps a granted designation** on the withdrawn row (visible,
  revocable, restored with access) but drops a never-granted one whose
  admission was deleted, so re-admitting the id brings no role back.
