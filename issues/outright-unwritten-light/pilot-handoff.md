# Pilot.6 installer handoff

Product **0.1.0-pilot.6** only; runtime **0.1.0-pilot.3** stays unchanged.
This worker inspected the pilot read-only. It did not continue the live apply,
change units/capabilities/sysctls there, reboot, or exercise real OAuth/provider
consent. Publication pins and review verdict are filled below after publication.

## Continue the original apply — no new approval

Use the shipped `operator/SKILL.md` from the independently verified product.
Do not rerun preparation, replace runtime inputs, edit site/secrets, reset a
journal, hand-edit units, change sysctls/file capabilities, or replace selectors
and installed executable. Retain the earlier 0711 bootstrap-parent repair.

1. Download the product and checksum assets through the trusted project release
   channel. Verify the independent product SHA-256 below BEFORE executing it.
   Extract into private local scratch and read the shipped operator guide.
2. Deliver only the authenticated product to a new root-owned non-writable
   `/opt/open-habitat-0.1.0-pilot.6-linux-amd64`, preserving `bin/` and `web/`
   executable/search modes (tar `--no-same-owner` as root). Do not replace the
   installed `/opt/open-habitat/current` selector. Use strict-pinned SSH with
   the customer's existing known_hosts and dedicated SSH identity.
3. As root set `oh=/opt/open-habitat-0.1.0-pilot.6-linux-amd64/bin/open-habitat`.
   Inspect the exact original journal and run preflight:

   ```sh
   "$oh" host operation show 2b013f00b02585b1ce2f3791054d6b44 --json
   "$oh" host check --site /etc/open-habitat/site.json --json
   ```

   Expected journal BEFORE continuation: running/converging **seq12**,
   original approval
   `df2f05edd103950b07d14095aec749feec17e90ca2b4936ebb931c4b05932fd5`.
   `gateway.listen` must pass; the unfinished-operation fence and absent
   serving/control readiness can still block overall check. Stop on unrelated
   blockers. Do not use any diagnostic plan ID as a new approval.
4. Continue with ORIGINAL approval and unchanged protected inputs:

   ```sh
   "$oh" host apply --site /etc/open-habitat/site.json \
     --approved-plan df2f05edd103950b07d14095aec749feec17e90ca2b4936ebb931c4b05932fd5 \
     --output=jsonl
   ```

   Require exactly one successful terminal result, same operation ID/approval,
   completed status and seq >12. The operator repairs only the exact legacy
   gateway unit into the declared low-port policy under the original lock,
   reloads systemd, resets failed gateway/revoke limits, starts broker/revoke and restarts gateway, then
   converges/reads back administration before reopening HTTP. The originally
   approved pilot.4 SERVICE EXECUTABLE and generation remain unchanged;
   pilot.6 is the maintenance operator, not an implicit service upgrade.
   On another failure retain this SAME operation and inspect its diagnostics;
   do not improvise a reset/new approval or reboot incomplete state.
5. Require successful `host check`, completed operation, and native readback:

   ```sh
   "$oh" host operation show 2b013f00b02585b1ce2f3791054d6b44 --json
   "$oh" host check --site /etc/open-habitat/site.json --json
   systemctl is-active open-habitat-broker.service open-habitat-gateway.service open-habitat-revoke.socket
   systemctl show open-habitat-gateway.service -p User -p AmbientCapabilities -p CapabilityBoundingSet
   "$oh" admin settings show --json
   "$oh" admin users list --json
   "$oh" admin storage list --json
   ```

   Confirm non-root gateway, exactly `cap_net_bind_service` in both sets,
   declared 443 listener, 21474836480-byte default quota and admission/admin
   readback. An unbound declared administrator must be reported
   `deferred_until_bound`, not falsely granted. Host verification uses the
   private root control socket; do not edit gateway administration JSON.
   Run the exact same apply command once more; require verified `no_change`
   with the same completed operation and no service restart.
6. From outside the VM, require CA-validating
   `curl --fail https://open-habitat.acme.test/healthz` (no `-k`), and normal
   HTTPS/OAuth redirect behavior. Verify editor-host TLS too. Only after this
   and successful host checks, perform the experiment's one authorized customer
   reboot, then repeat operation/check/service/capability/443/healthz checks.
   Do not reboot over incomplete apply. No source checkout or Fleetrepo is
   required on the pilot.
7. Jari's first human step remains GitHub browser sign-in and his own provider
   authorization. After the first binding, run supported fresh apply planning
   and its new approval to realize the previously deferred administrator grant.
   Preserve the documented manual certificate renewal by 2026-12-20 and use
   the shipped same-site TLS rotation recipe after this operation completes.

## Runtime anchors (unchanged)

From the prior independently pinned installer inputs:

```text
961cb34db858463506108dd12695ab492e8260fde500c6764358b7df9010b9b2  release.json
6ef1ffba9bf1ec8962cba69a7145c84ee3e428bb2b65c2160b187be731070c3b  release.sig
97963aebfb20e5426281433c6c20673559aaba362273951572c401b281180268  pilot-development.pub
```

Keep all twelve existing runtime archives and the installed independently
approved raw key. No runtime rebuild, resigning or runtime pilot.6 is involved.
