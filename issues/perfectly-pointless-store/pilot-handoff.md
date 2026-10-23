# Pilot.4 installer handoff

Product prerelease: https://github.com/Open-Habitat/open-habitat/releases/tag/v0.1.0-pilot.4
Product version **0.1.0-pilot.4**; source `7e04fb4f8395e6ad9dc38d7a078d7a3e217421de`.
Published prerelease; all four assets downloaded back, matched independent
local checksums, and product verification/version/source checks passed.
See result.md for scope and recovered publication-tool interruptions.

## Independent pins and unchanged runtime

| Input | Source tag | SHA-256 |
|---|---|---|
| `open-habitat-0.1.0-pilot.4-linux-amd64.tar.gz` | v0.1.0-pilot.4 | `4ab183ed0abb880785c554c820e769d176da3a9a3f556c6e277fbc93f3e52b00` |
| `release.json` | v0.1.0-pilot.3 | `961cb34db858463506108dd12695ab492e8260fde500c6764358b7df9010b9b2` |
| `release.sig` | v0.1.0-pilot.3 | `6ef1ffba9bf1ec8962cba69a7145c84ee3e428bb2b65c2160b187be731070c3b` |
| Existing approved raw Ed25519 key | unchanged | `97963aebfb20e5426281433c6c20673559aaba362273951572c401b281180268` |

**This is a product-only release. Keep the protected site's runtime version
`0.1.0-pilot.3` and manifest digest above unchanged.** All twelve pilot.3 runtime
archives are reused byte-for-byte from v0.1.0-pilot.3; none is rebuilt/re-signed
or copied into pilot.4. The runtime manifest's source remains
`f3b2e732d30a34ebd20cceb1b3ae82e1afe3ec4c`. Product/runtime version equality is
not required. Runtime manifest/profile/parser/package contracts are unchanged
from pilot.3, and the pilot.4 source authenticates the actual pilot.3 manifest
and selects all twelve profiles. An independent Ed25519 primitive verification
also passed. This is compatibility/authentication evidence, not fresh archive,
apt or live installation acceptance.

## Continue this pilot's incomplete prepare

No pilot changes were made by the product worker. The customer installer must
perform the following in its authorized maintenance window, using the shipped
operator guide, not source/Fleetrepo or improvised unit/journal edits.

1. Download the pilot.4 product from the trusted release channel; verify its
   independent SHA-256 above **before execution**. Extract as root into the new
   root-owned non-writable `/opt/open-habitat-0.1.0-pilot.4-linux-amd64`, preserving
   `bin/`/`web/` and executable/search modes (use `tar --no-same-owner` when
   extracting delivered media as root). Retain protected site, OAuth/TLS inputs,
   existing approved release key, all identities and original operation files.
2. Inspect the journal with the **new** product:

   ```sh
   oh=/opt/open-habitat-0.1.0-pilot.4-linux-amd64/bin/open-habitat
   "$oh" version --json
   "$oh" host operation show c18ecc2ecde0500d7fd1764e208a365f --json
   "$oh" host prepare --site /etc/open-habitat/site.json --dry-run --json
   ```

   Require product version pilot.4 and the pinned source above. The old prepare
   must still be running at `session_restarting`, target runtime pilot.3 with
   the pinned manifest. The preview must succeed, `data.plan.approvable=true`,
   check `operation.fence=pass` with reason
   `prepare_session_continuation_verified`, and plan policy roll-forward/session
   restart **without another quota probe**. Read-only checks require matching
   receipt/fence, no journal split or unknown policy publication, original cleaned EDQUOT probe, absent
   probe directory, original zero limits/usage on the same mount, safe native
   exemption group, and unchanged remaining product policies. Do not reboot
   first: a changed mount intentionally blocks this continuation.
3. Copy **that preview's `data.plan.plan_id`**, not the old pilot.3 plan ID, into
   the real invocation, explicitly approving the disruptive session restarts:

   ```sh
   "$oh" host prepare --site /etc/open-habitat/site.json \
     --approved-plan <NEW_PREPARE_PLAN_ID> --approve-disruption --output=jsonl
   ```

   Require exactly one successful terminal result, `outcome=prepared`, original
   operation ID `c18ecc2ecde0500d7fd1764e208a365f`, completed status and advanced
   sequence. Its recorded original plan ID stays unchanged: the new approval
   authorizes only the verified roll-forward, not a replacement operation.
   Reinspect the operation, `systemctl is-active open-habitat-proc.service
   systemd-logind.service polkit.service`, and `findmnt -no OPTIONS /proc`.
   The installed proc unit must use numeric `gid=988` for the observed group;
   effective proc must retain hidepid=invisible (or equivalent hidepid=2).
   A retry after another interruption needs another verified preview/approval.
   If any check refuses, stop with its evidence; do not delete/reset the journal,
   change pins, hand-edit the unit or skip preparation.
4. After preparation completes, resume the normal shipped installation guide.
   The pilot still has **pilot.1 runtime input media** under
   `/var/lib/open-habitat/release`; pilot.3 archives had been verified locally
   but were not delivered after the prepare failure. Independently authenticate
   and transfer the complete unchanged pilot.3 manifest/signature/selected
   twelve archives as trusted root-owned non-writable files. Verify the existing
   key against its independent pin; do not replace trust from a downloaded key.
   Refresh customer apt indexes as the guide requires. Run pilot.4 `host check`,
   then a fresh apply dry-run/approval. This is still a fresh installation (no
   installed gateway/generation/bindings), not `host upgrade`.
5. Continue only on successful apply and verified services, real CA-validating
   HTTPS ingress, supported reboot/post-boot checks and later human GitHub/Pi
   provider authorization. Rerun supported apply after first binding to realize
   the deferred administrator role. No prior worker has verified these outcomes.

## Certificate renewal

Customer renewal remains due **2026-12-20**. Renew externally through the existing
customer DNS-01/SOPS process; no DNS administration credential goes on the VM.
The shipped guide now specifies TLS source paths from the site declaration,
protected source-file replacement, fresh same-site apply, generated TLS copies
and gateway **restart**, and CA-validating origin/edge verification. There is no
hot reload or automatic renewal timer. Resolve the incomplete prepare/install
first; no certificate currently serves public HTTPS on this pilot.

## Acceptance boundary

UNGATED test release, with focused Go, contract, package, rootless native
remount/isolation and independent hostop review evidence. No VM qualification
was run. The pilot was inspected read-only; the next customer installation is
acceptance. Keep these limits in its result rather than treating a published
package as proof the pilot is installed.
