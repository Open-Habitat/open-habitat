# Result: gateway low-port binding, product pilot.6

## Decision

The public gateway uses direct `net.Listen`; only the existing private revoke
Unix socket and daemon sockets have activation support. Choose the authorized
capability fallback rather than redesigning both public activation and the
private FD-name contract. Render only CAP_NET_BIND_SERVICE into ambient/bounding
sets for declared ports 1–1023, both empty at 1024–65535. Keep nonroot identity,
NoNewPrivileges and all other sandboxing. No file capability or host sysctl.

The only late recovery policy mutation is exact legacy gateway unit → exact
current declared-port unit. It runs under the original operation lock/input
binding, closes HTTP entry, reloads systemd, verifies all units, clears failed
start limits and starts services. No generation/snapshot/selector/binary change,
apt replay, broker reseed, journal reset or new approval. A later upgrade
recognizes the exact repaired live gateway unit against its old snapshot.

## Read-only pilot observations

Strict-pinned SSH with customer known_hosts and its dedicated identity confirms:
operation 2b013f00b02585b1ce2f3791054d6b44 is running/converging seq12;
original approval df2f05edd103950b07d14095aec749feec17e90ca2b4936ebb931c4b05932fd5;
runtime pilot.3 manifest 961cb34db858463506108dd12695ab492e8260fde500c6764358b7df9010b9b2.
Kernel privileged-port threshold 1024; no listener on 443; gateway nonroot with
empty ambient capabilities; journal listen_failed then start-limit-hit.
Broker active; root:gateway /run/open-habitat 0750, broker.sock 0660 is writable
by gateway identity; shared config ancestor root:root0711, maintenance fence
present 0644; revoke socket absent after its failed startup. No pilot mutation
performed by this worker.

## Downstream path checked

- Existing private root-only revoke socket is the sole inherited FD; capability
  fallback does not change LISTEN_FDS/FD names or SO_PEERCRED authorization.
  Missing revoke socket/start-limit is retried by fixed systemd units, not by
  fabricating socket files.
- Gateway broker access uses the configured numeric service identity, trusted
  root:gateway socket directory and broker socket, not a high TCP port or a
  Fleetrepo proxy. Pilot read-only access checks pass; a transient logged
  broker_unavailable during failed service startup is not proof of a persistent
  broker defect. Inspecting the full path found no confirmed further blocker.
- waitControl probes private administration, then users forces broker admission
  observation. Default quota is changed through the gateway; settings and bound
  administrators are read back, unbound administrators remain explicitly deferred.
  No root edits to administration state or precreated user assumptions.
- verifyStructure reobserves pool/NSS, signed runtime, generation, broker epoch,
  prepared policy, boot storage and active services; transient oneshot storage
  need not remain active. No Fleetrepo-provided service is assumed.
- openEntries verifies structure/settings before unlinking the root-owned HTTP
  fence; the private control is intentionally outside the HTTP fence. /healthz
  passes through that fence and the normal TLS listener. External CA-validating
  curl remains required after reopening; private control success does not prove
  HTTPS, OAuth/provider consent or reboot.
- Declared port updates across 1024 recognize both exact product capability
  variants as inputs; strict final verification requires the current variant.
  Future predecessor upgrade verification accepts only the exact repaired live
  gateway policy, retaining immutable snapshot evidence.

## Validation

Focused Go host/CLI/gateway tests and vet, root-container transaction/distinct-UID
suite, generated contracts and project-view validators, production web build,
and disposable native kernel bind test. The kernel test fixes its PRIVATE
network namespace's threshold at1024: nonroot443 without capability fails,
with exactly NET_BIND_SERVICE and NoNewPrivileges succeeds; high8443 succeeds
with no capabilities. It does not start systemd or claim public TLS acceptance.

Synthetic original journal at converging seq12 and legacy low-port unit is
continued with the same operation ID/approval; production policy roll-forward
helper is used. Changed secret, wrong approval, early staging and split receipt
refuse; completed retry is no-change. This is synthetic transaction/policy
proof, not whole-host service convergence.

An initial test fixture tried to encode host_action_failed into the journal
reason, which correctly rejected that non-journal enum. Corrected to the actual
observed empty journal reason (listen_failed belongs to service diagnostics),
then reran successfully. No product validator was weakened.

Review, publication pins and exact installer continuation are recorded in
pilot-handoff.md when the release is published. This is an ungated disposable
product-only test release; runtime pilot.3 is unchanged. No live installation,
public HTTPS, reboot, OAuth or model-provider acceptance is claimed here.

Review also exposed a relevant preflight limit: a customer-raised privileged-port
threshold above1024 could leave a capability-free high port unusable. Preflight
now refuses ports1024+ below that kernel threshold (or unavailable threshold),
without adding authority or changing sysctl; boundary tests cover both sides.
Additionally, activation restarts when gateway unit bytes change, and late
recovery restarts the gateway after reload even if an old process is still
running, so the live process actually acquires the declared policy. Completed
no-change retries still bypass recovery/restarts entirely.

## Independent review and assessment

One focused /llm-review: finder claude-fable-5-1 and narrow adversarial verifier
gpt-6-astra. /assess-findings classified the raised-threshold preflight finding
CONFIRMED/OCCASIONAL/NEUTRAL/MINOR → FIX; fixed with boundary tests. No outstanding
confirmed defect or follow-up issue. Verifier traced original-input continuation,
exact capability authority/restart, private readback, HTTP fence ordering and
later upgrade snapshot handling. Scratch reports are history/review-pilot6-gateway-bind.md
and history/assessment-pilot6-gateway-bind.{json,md}; this result preserves the
conclusions without requiring those local files.

Further read-only pilot checks confirm CapPrm/CapBnd both include bit10,
FragmentPath is the product /etc unit with no drop-ins, and installed gateway
unit bytes exactly match the recognized legacy repair input.
