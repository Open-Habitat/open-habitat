# Gateway ancestry / pilot.5

Origin: taskfleet `01m5m1zy6trwwymtez2k53z9sz` (spinoff).

## Attribution and read-only pilot observation

The customer installation record explicitly records creating `/etc/open-habitat`
as 0700 during the first bootstrap. Product apply creates absent policy parents
as 0755 and sets only the nested gateway parent to 0750; it never changed the
shared parent's mode. The guide's unspecified protected/private bootstrap
wording let the installer choose a mode that check/plan wrongly accepted.

Pinned SSH root inspection used only stat, getfacl, systemctl status and
journalctl. Confirmed root:root 0700 shared parent with no extended ACL;
root:gateway 0750 generated subtree, 0640 gateway.json; gateway failed with
config_io and start-limit-hit, revoke socket failed consequentially, broker
active/ready. No secrets read, no pilot permissions/services/journal changed.
The customer's retained journal record is converging seq 10 of apply
`2b013f00b02585b1ce2f3791054d6b44`, original approval
`df2f05edd103950b07d14095aec749feec17e90ca2b4936ebb931c4b05932fd5`.

## Decisions for later review

- Keep customer ownership of existing bootstrap permissions: the operator repairs
  the inspected root:root ACL-free 0700 parent with one nonrecursive chmod0711.
  Product check/plan and under-lock revalidation refuse unsafe traversal; apply
  does not silently change customer metadata. Canonical 0711 or0755 shared parent,
  private 0600 sources/0700 secrets directory, separate 0750 gateway subtree.
  Search-only common ancestry exposes no secret bytes; no named ACL is needed.
- A successor operator may complete an activated apply by reconstructing the
  original binding using its trusted installed executable. It must match the
  entire persisted binding, original approval and durable late-phase journal.
  No binding rewrite, apt, generation replacement or broker initialization.
  The original installed service product stays unchanged. Product replacement
  remains a separately qualified upgrade; this repair is not an upgrade.

## Implementation and validation

Added ancestry refusal to native preflight/config postcondition; documented
bootstrap commands, exact repair, same-operation continuation and concrete TLS
rotation in both source guide and the shipped operator skill. Late recovery
verifies installed generation/config/units, reestablishes the HTTP fence,
clears fixed gateway/revoke start limits, starts them, converges/validates and
only then reopens entry. Source/key/site identity drift still refuses.

Synthetic journal test constructs converging seq10 and checks same-ID original
approval completion, no reseed/republication, blocked unrepaired state, changed
secrets, earlier phase, wrong approval, split journal and exact repeat.
Root-container tests exercise native preflight without changing the parent and
real distinct-UID config readability/source-secret and foreign-UID denial.
This is not live systemd recovery, HTTPS, reboot or browser/provider evidence.

A pre-existing prepare fixture failed under required umask077 because its
synthetic policy stage inherited0600 instead of the protocol's0644. Both stage
writes now explicitly set0644; production preparation code is unchanged.

Validation and publication results follow after completion.

Focused validation passed under umask077 with disk-backed TMPDIR:
`go test ./internal/host ./internal/cli`, `go vet` of both packages,
`go generate ./internal/contracts` plus generated diff check,
`python3 scripts/validate-contracts.py`, project-view validator, issue doctor
and diff whitespace. `scripts/test-host-initialization-uids.sh` passed,
including actual root preflight, both kernel UIDs and all new binding/journal
cases. Native systemd/quota/VM-only scenarios remain explicitly skipped, not
accepted-host evidence. `npm ci --prefix web` and production build passed;
no browser behavior changed or browser suite claimed. Package verification
passed on candidate source f7491b98 before the review-only test/comment fix.

Downloaded pilot.3 release.json, release.sig and development public key from
its release; all three match independent handoff pins. New source authenticated
that actual manifest and selected all twelve profiles. Independent Ed25519
primitive verification passed. This rechecks compatibility/authenticity, not a
fresh runtime archive download, apt transaction or installed native acceptance.

Finder claude-fable-5-1 reviewed f7491b98, ran focused tests/vet and found no
must-fix. One low test-evidence defect was confirmed: a nonroot mode-refusal
assertion actually rejected GID first. Moved its root-group skip before that
assertion; the real root-container mode/UID tests already passed. Added a
comment clarifying the continuation helper is called under executeApply's flock.
The independent high-risk adversarial verification is pending before publication.
