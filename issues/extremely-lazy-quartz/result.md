# Hands-on pilot serving round

Origin: taskfleet `01m5m4q6km8z20egt16p4sb9bs` (spinoff).

## Adopted fix and first live loop

Adopted preserved commit ba71f6d269f622d209bc1f5218d11026811021fb.
The public gateway has no TCP activation reader; its inherited listener is the
private Unix revoke/control socket. The explicitly authorized fallback grants
only NET_BIND_SERVICE, ambient and bounded, for declared ports below 1024.
Nonroot identity and NoNewPrivileges remain; high ports have empty sets.
Preflight checks local address and systemd/kernel binding authority. Late apply
repairs only exact recognized product unit bytes under the original approval,
reloads and restarts before control convergence. No handwritten unit, journal,
broker state, selector, file capability or sysctl workaround was used.

Built production web assets and a static packaged development product from
bf1bae3f, version 0.1.0-pilot.6-dev; delivered it to a new root-owned /opt
package directory over pinned SSH. This is direct branch testing, not a release.
Original apply 2b013f00b02585b1ce2f3791054d6b44, original approval
df2f05edd103950b07d14095aec749feec17e90ca2b4936ebb931c4b05932fd5,
completed from converging seq12 to completed seq17. Gateway native policy reads
cap_net_bind_service. Host check ready=true, every check passing. Exact original
apply retry succeeded without changing the completed operation. Administrator
subject 1272053 is explicitly deferred_until_bound.

Real ingress: CA-validating HTTPS /healthz returns status ok. OAuth start returns
GitHub authorization redirect with exact redirect_uri
https://open-habitat.acme.test/auth/github/callback. No callback, browser login
or provider authorization is claimed. Initial boot ID was
56ea5db7-e531-4679-8ebe-4b5a9214e646.

The repair intentionally leaves pilot.4 service bytes active. To meet the
served-build requirement, use the existing authenticated named-successor upgrade
rather than bypassing that invariant. A distinct signed transition manifest is
required even with unchanged runtime archives. Development successor metadata
names the exact pilot.3 generation and pilot.4 executable hash; all twelve
runtime archive bytes/descriptors remain unchanged. The development key remains
on Alder, never copied to the pilot or git. Operator guides now explain this
product-only upgrade requirement.

## Validation so far

- Go host, CLI, gateway tests; host/CLI/gateway vet.
- Real private-network kernel bind regression: nonroot 443 denied without cap,
  succeeds with exactly NET_BIND_SERVICE and NoNewPrivileges; high8443 cap-free.
- Disposable root-container host transaction/distinct-UID suite.
- Fresh npm ci/production web build and packaged development product.
- Generated contracts and project-view validation; whitespace check.

Completion, review, reboot and published-product evidence follow below when
verified. No completed release/install claim is made by this interim record.
