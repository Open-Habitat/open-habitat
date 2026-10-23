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

The predecessor worker published pilot.6 at 10:24:47 UTC, one minute
before this run was spawned at 10:25:47 UTC. Before this worker's download its product download count
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

## Corrected installed build cold-boot acceptance

Dev2 upgrade operation 4f6894527b2494cbbe6f60a89a58bccb completed seq6,
owner generation50d7e0d28dbfbf8a5a2f547fa6a42c0a56c41a6436e5e625c2a5fded47cb3c1d.
Actual running executable SHA-256
49dfeaa8e66877c99b950713d4ae6a7ca7fa4d6e08a651d234039aeafdfb7ad0,
source52b103ea27023836e640bf9c814d88dd75438b32. Second reboot changed boot ID
to2fdd84c5-85f7-46af-b013-01d3c6cd271e. This corrected installed build now
passes every host check and real CA-validating health/UI/OAuth redirect checks
after cold boot with polkit still dormant. No failed units. Editor wildcard TLS
also verifies (HTTP401 without editor grant is expected).

After preserving that clean dormant receipt, a normal read-only D-Bus Authority
introspection activated polkit through Ubuntu's own bus activation. Its actual
kernel groups include988; host check also passes in this active state. This is
explicit coverage of both legitimate lifecycle states, not a manual start used
to conceal the original blocker.

Model-performance logging initially hit the known SSH-to-self rejection. The
skill's documented ASSESS_MODELS_SSH_BIN override retried through a bounded
same-host transport, leaving the helper's own corpus locking/git writer intact;
logging succeeded at model-performance/runs/2026-10-23-llm-review-hands-on-pilot.

## Onboarding integration: signed dev3

The onboarding worker handed over tested commit
f09579336ab46e72330758039f16757ebd3865ce; adopted as418a23dd776a6195e495eb53f5ec59881236bb36
on top of the cold-boot fix. Its independent focused review and HTTP/2 ALPN
mapping tests supplement this round's review. Local host/gateway/CLI race tests,
vet, contracts, project-view and package verification pass. Live baseline
confirmed exact catalog route HTTP/2=400 versus HTTP/1.1=401 without credentials.

Jari has since signed in, creating the one native binding. Dev3 preview correctly
refused predecessor_not_healthy because the declared administrator was still
deferred: user1272053 bound, administrators empty, default quota20GiB. Previewed
then used supported `admin role update1272053 --administrator true`; readback
now confirms the declared administrator. No gateway state file was edited and
no production session/cookie was copied or fabricated.

The requested deploy's maintenance inventory contains the user's daemon plus
standard Ubuntu user sockets/timer, zero active turns observed. Browser session
preservation remains the native upgrade's responsibility. Onboarding worker
retains ownership of its issue/readback/closure; this issue records installation
receipts only. Final dev3 operation/readback follows after verified deployment.

Dev3 deployment completed with explicit interruption approval for the exact
current maintenance plan, retaining the native session-preservation contract.
Operation cda46b218f724801bfce27c96bd65856 completed seq6, approval
9b3bfdfa3f3ec5e5f66cfdd9c4b69088358a20855c0bf8f9a6b6294da5f87736.
Actual gateway executable source418a23dd776a6195e495eb53f5ec59881236bb36,
version0.1.0-pilot.6-dev3, SHA-256
90c4c50c2b3a8f7875c10a6ee3d1f1a5ebe47236984979c5722175f928d3ee47,
generationa80e8bcfe3f3da533a70be19efff00fb92e43db6c190aaae3222e47d540e3498.
Host check all pass; broker/gateway/revoke active; CA-validating health/UI and
exact OAuth callback redirect pass. Live unauthenticated HTTP/2 catalog changes
from400 to401 authentication_required; fixed rejection diagnostic observed.

A local final assertion initially expected the wrong symbolic error
`unauthenticated`; the actual contract is `authentication_required`. Corrected
that assertion and reran it successfully. The upgrade itself completed cleanly;
no operation retry, reset or production change was needed for this test typo.
Version/source/hash/operation readback was sent to the onboarding worker, which
owns authenticated catalog count and Jari refresh confirmation.

## Final release authorization and upstream integration

Conductor relayed Jari's standing authorization to publish0.1.0-pilot.7 because
pilot.6 was taken by the predecessor; preserve that published release. Include
the HTTP/2 fix and compatible origin/main work. Conductor reports successful
repository-route200 responses at11:00–11:01UTC, establishing chooser refresh.
Onboarding worker independently verified actual dev3 identity, complete54 native
repositories and public HTTP/2 authentication routing.

Fetched origin/main6f796508 and rebased cleanly, without conflicts. Included
upstream conversation metadata/start-page selection/model-chip UI improvements
and their accompanying specifications/tests. No new service/socket authority or
runtime payload change is introduced by those upstream changes. Final release
uses fresh production web assets and exact signed predecessor dev3 metadata;
all twelve pilot.3 runtime archive bytes remain reused.

## Completed: released pilot.7 now serves

Published pilot.7 from source1759a8456a999f33fdcc9993321b7c732bdf69c3,
tree8afbeeaa4b510d4a83ee8b791185cb9fc7d03048, including compatible
origin/main6f796508 and HTTP/2. Integrated548 web tests,9 focused browser cases,
host/gateway/CLI race tests and vet passed. Publication/download/full checksum
and signature verification passed; all twelve archives are unchanged pilot.3
bytes, with new signed product-transition metadata. Public pilot.6 was untouched.

Installed the **downloaded released package**, not its dev build, through the
documented preview→stage→immutable-owner native upgrade. Exact current plan
d0da852d1690684a90f78c6f67bf5b9407fd8779d87c9b1a3e29ccd24dc71b1a
observed zero active turns and unchanged standard user-service inventory.
Under conductor's final-release maintenance authorization, product-managed
upgrade2c01c98d39e25eab0981022579cd6f56 completed seq6. Native session/state
preservation and mapped-user adoption checks passed.

Actual running gateway executable SHA-256
5a0b72452798e95cab4e36deed252480541ddcd694cee65211a2a5dc3d1eae43
and embedded source/version exactly match signed released bytes. Public index
also byte-compares equal to the downloaded product. Host check is completely
clean; broker/gateway/revoke active; no failed units. Actual process UID31000,
NoNewPrivs1, effective/bounding/ambient sets exactly NET_BIND_SERVICE. Public
CA-validating health/UI, exact OAuth callback redirect and HTTP/2 auth routing
pass. Jari's declared administrator role and20GiB default quota are read back.
Exact completed upgrade retry returns no_change and leaves gateway PID7023
unchanged: no unnecessary restart or second maintenance interruption.

[The final handoff](pilot-handoff.md), [pins](pilot.7-pins.sha256),
[release receipt](release-gate.json) and [verification](verification.json)
record installed identity, evidence/limits, next human steps and manual TLS
renewal responsibility. All required steps are complete under the approved
pilot.7 version adjustment. No full clean gate, production-key custody or
model-provider entitlement is claimed. No required tool/sub-workflow failure
remains unresolved. Main is not pushed by this worker; the conductor owns that.
