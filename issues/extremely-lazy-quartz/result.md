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

## Cold reboot found and fixed a real check defect

The signed development upgrade completed as operation
7b58bfe31d5f273ac3c946d0443eb7a3, seq6. Actual running gateway executable
was generation 2bf590969238e65edaf81aa28a4e89958574f65fd5da1ceedc4e1a865af0f232,
version 0.1.0-pilot.6-dev, source bf1bae3f8b3100fdb2a6d29a79f878b18c2ed983,
SHA-256 b1a289def77b1b6c7c2d53d1d54c4f7fc719813f9c57d0429340273cae38a4db.
The upgrade exercised the formerly untested legacy-snapshot/repaired-live-unit
predecessor path on the actual pilot, not just a synthetic fixture.

One real reboot changed boot ID to 21eed9a9-0f1a-4a18-a8ab-560437cc3217.
Storage/proc gates and gateway/broker came up without failed units. Host check
nevertheless blocked: storage.boot_policy remained unavailable. Diagnostics
showed polkit's loaded static D-Bus service inactive/dead/MainPID0, while logind
ran with actual group988. No authorization caller had started polkit yet.
This was a false requirement that an on-demand service already be running.

Commit 52b103ea corrects read-only observation: loaded dormant polkit with exact
launch exemption group is accepted without reading a nonexistent process;
logind must run; every active process still needs native group membership.
Failed/masked/missing/wrong-group and inconsistent dormant-PID states refuse.
Focused regression cases and host/CLI/gateway tests pass. Built dev2 and ran its
real host check against this unchanged post-reboot host: all checks pass while
polkit remains dormant. No service was manually started to hide the defect.

## Release-name collision

The cancelled predecessor worker published pilot.6 at 10:24:47 UTC, shortly
after this run began. Before this worker's download its product download count
was zero. The artifact names source ba71f6d2, exactly the adopted low-port code;
its own immutable release receipt explicitly disclaims reboot/live acceptance.
We downloaded and verified it, but it predates the cold-boot correction. It
cannot carry that fix without replacing published bytes/tag. Requested approval
for pilot.7 instead; did not rewrite a public release or main history. Any
previously sealed pilot.6 transition metadata here remains private unused scratch,
not a published release or installed successor.

## Independent review and assessment

Focused `/llm-review` used claude-fable-5-1 as finder and gpt-6-astra as fresh
adversarial verifier. The verifier included the new cold-boot correction and
traced dormant versus running process validation, original-input transaction
binding, exact unit repair and full predecessor fragment/override validation.
No current correctness or authority defect survived. `/assess-findings` retained
one documentation clarification (already fixed) and dropped four speculative or
coverage/portability candidates; no residual review issue was filed. Model
agreement is not confirmation: live recovery/upgrade, actual executable hashes,
reboot observations and local refusal tests are the evidence. Scratch reports:
history/review-hands-on-pilot.md and history/assessment-hands-on-pilot.{json,md}.

Final focused checks include host/CLI/gateway `go test -race`, vet, native bind
regression, root-container transaction/distinct-UID tests, contracts drift,
project-view, issue doctor and whitespace checks. All pass. Full clean gate and
human/provider authorization remain unclaimed; this is a disposable ungated
pilot, not a production qualification.
