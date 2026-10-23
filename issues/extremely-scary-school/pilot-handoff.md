# Pilot.5 installer handoff

Product-only prerelease **0.1.0-pilot.5**. Runtime **0.1.0-pilot.3** is reused
unchanged: do not change the protected site's runtime version/manifest,
profile set, identity/storage/admission fields, key or secret references.

## Independent runtime pins

Download runtime inputs from **v0.1.0-pilot.3**, not pilot.5:

| Input | SHA-256 |
|---|---|
| `release.json` | `961cb34db858463506108dd12695ab492e8260fde500c6764358b7df9010b9b2` |
| `release.sig` | `6ef1ffba9bf1ec8962cba69a7145c84ee3e428bb2b65c2160b187be731070c3b` |
| Approved raw Ed25519 key | `97963aebfb20e5426281433c6c20673559aaba362273951572c401b281180268` |

The existing pilot already has the verified complete twelve-profile runtime
and installed Ubuntu requirements. Do not redeliver/replace protected inputs
as part of this continuation. No archive, runtime manifest/signature or key
was rebuilt or re-signed for pilot.5.

## Exact continuation on this pilot

The product maintainer inspected the pilot **read-only**. The following steps
are for the separately authorized customer installer in a maintenance window.
No source checkout or Fleetrepo is required.

1. Independently authenticate the pilot.5 product archive using its product pin
   below before executing it. As root extract to the new versioned
   `/opt/open-habitat-0.1.0-pilot.5-linux-amd64`, preserving executable/search
   modes and root ownership (`tar --no-same-owner`). Do not replace the old
   package, `/opt/open-habitat/current`, installed generation or journal.
2. Inspect the original operation and metadata:

   ```sh
   oh=/opt/open-habitat-0.1.0-pilot.5-linux-amd64/bin/open-habitat
   "$oh" version --json
   "$oh" host operation show 2b013f00b02585b1ce2f3791054d6b44 --json
   stat -c '%n %U:%G %a' /etc/open-habitat /etc/open-habitat/gateway
   getfacl -p /etc/open-habitat /etc/open-habitat/gateway
   "$oh" host check --site /etc/open-habitat/site.json --json
   ```

   Require the published pilot.5 source/version. Require the original apply
   still running/converging at seq10, original approval below, and runtime
   pilot.3. Check must identify the unusable shared parent as
   `gateway_parent_requires_root_0711_or_0755_no_acl`. Expected existing mode:
   root:root0700 without extended ACLs; gateway subtree root:gateway-group0750.
   Stop on unexpected state rather than inventing a repair.
3. This release supports the following **single nonrecursive bootstrap repair**:

   ```sh
   chmod 0711 /etc/open-habitat
   "$oh" host check --site /etc/open-habitat/site.json --json
   ```

   Only the common parent's mode changes. Do not chmod source secrets, site,
   trust key, generated subtree/files or units, add ACLs, reset service state
   manually, or edit/remove operation files. Parent check must now pass;
   `operation.fence / recovery_required` and gateway/control unready evidence
   are expected until recovery. A new apply plan cannot supersede this fence.
4. Continue with the **original** approval and unchanged protected inputs:

   ```sh
   "$oh" host apply --site /etc/open-habitat/site.json \
     --approved-plan df2f05edd103950b07d14095aec749feec17e90ca2b4936ebb931c4b05932fd5 \
     --output=jsonl
   "$oh" host operation show 2b013f00b02585b1ce2f3791054d6b44 --json
   ```

   Require exactly one successful terminal result, `applied` (verified
   `no_change` on a successful repeat), SAME operation ID/approval, completed
   status and advanced sequence. New product reconstructs the original full
   binding using the trusted installed pilot.4 executable digest. Source-file
   replacement, even with identical bytes, blocks; do not replace inputs to
   “repair” this. Split/partial state and earlier phases are not authorized.
   Late recovery checks installed generation/config/units, closes HTTP entry,
   clears failed gateway/revoke start limits and starts the fixed units,
   converges settings and validates before reopening. No apt replay, broker
   reseeding, generation replacement or journal reset occurs.
5. Verify with the corrected operator:

   ```sh
   "$oh" host check --site /etc/open-habitat/site.json --json
   systemctl is-active open-habitat-proc.service open-habitat-broker.service \
     open-habitat-gateway.service open-habitat-revoke.socket
   curl --fail --connect-timeout 10 --max-time 20 https://open-habitat.acme.test/healthz
   openssl s_client -connect open-habitat.acme.test:443 \
     -servername open-habitat.acme.test -verify_hostname open-habitat.acme.test \
     -verify_return_error </dev/null
   ```

   Inspect certificate SAN/serial/expiry; verify configured editor ingress too.
   Perform the customer-authorized reboot only after completion/healthy checks,
   then repeat checks. Do not reboot first. Browser GitHub callback and personal
   Pi/provider authorization remain human acceptance, not release evidence.
   Rerun ordinary same-site apply after first binding to realize deferred admin.

The **operator** is pilot.5; the installed gateway/broker remain the originally
approved pilot.4 product, whose runtime is pilot.3. This is deliberate: recovery
finishes the original intent without smuggling a binary upgrade into it. Future
maintenance uses the corrected operator; replacing installed product requires a
separately qualified successor upgrade. Do not claim installed version pilot.5.

## TLS rotation

The shipped `operator/SKILL.md` now includes the full recipe: finish incomplete
operations first, renew outside the VM, take source paths from protected site
`gateway.tls_cert_file`/`tls_key_file`, stage root:root0600 replacements in their
private parents, publish both, preview fresh same-site apply and approve its NEW
plan ID. Apply publishes generated root:gateway0640 copies and restarts (not
reloads) the gateway. Verify CA-validating ingress and presented SAN/serial/expiry;
a TLS-terminating edge needs its own renewal and verified origin hop. Keep DNS
admin credentials off this host. No automatic renewal timer is installed.
Customer renewal deadline remains **2026-12-20** through its own DNS-01/SOPS
process. Do not rotate inputs before this incomplete apply finishes.

## Product pins and verification

To be filled from the final committed, reviewed package and download verification.
