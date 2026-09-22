# Host stack decision result

## Outcome

The proposed smallest secure stack is one locked Rust codebase and one static
release artifact containing two runtime roles: a dedicated non-root authenticated
gateway and a systemd socket-activated daemon for each allowed Unix user. Browser
authentication is OIDC Authorization Code + PKCE with an administrator-owned
immutable `(issuer, subject) -> Unix user` mapping and opaque server sessions.
The gateway routes HTTP/1.1 over a fixed per-user Unix socket; each daemon checks
the gateway's Linux `SO_PEERCRED` UID. Native Pi, Git, SSH and GitHub credentials
remain only in the user's environment.

The daemon directly owns Pi RPC children. Browser and gateway loss do not stop
them. Daemon loss or host reboot does stop active work; Pi's native JSONL history
survives and may be deliberately resumed only after the prior writer's exit and
history settlement are proved. A terminal-started TUI remains read-only, and
Taskfleet remains the owner of its worktrees. This avoids a second supervisor,
process registry, credential broker, workspace registry or history store.

The durable proposal is [ADR 0003](../../docs/adr-0003-host-stack.md), with the
reader-facing topology in [architecture](../../docs/architecture.md), the
operational recommendation in [implementation](../../docs/implementation.md),
and the decision registered in [decisions](../../docs/decisions.md). ADR 0003 is
**Proposed**. `review-implementation-plan` remains the acceptance gate.

## Inspected repository and Fleetrepo evidence

Decision date: 2026-09-22. The worker began substantive work after committing the
issue's in-progress transition as `53ff888505fb0f89f335fa84020c7a6bfffba601`.
The required repository sources were read in full at that worktree revision.
Relevant durable source revisions were:

| Source | revision containing inspected file |
|---|---|
| ADR 0001 | `642bd26c7f68009c8c59f284aca04f169ed97598` |
| proposed frontend ADR 0002 | `ffdf0e6eeb46aa44055b52569775d20956db1a01` |
| Pi control result | `4187da0ec40079ec09d98539c03f840102cde616` |
| workspace lifecycle result | `c1e06b0af9a2835106b5f27277dd1de31766856a` |
| Fleetrepo checkout | `c8f8cc95cea94a4ede8fde5aa206354684b616f8` |
| Fleetrepo fleet/Alder integration owner | `233e13f6248d8472f8096f2aba4cb3bfc609fbb5` |

The decision also read the root and docs instructions, implementation plan,
accepted UI review, product, UI, architecture, assumptions, decisions, Fleetrepo
root and dotfiles instructions, fleet inventory, Alder agent-host runbook, Alder
machine page and its system prerequisite hook. No Fleetrepo file was modified.
No live service, user, unit, credential, package, Pi session or Alder deployment
was changed.

Read-only host facts on Alder were Linux `7.0.0-31-generic` x86-64, systemd
259, Rust/rustc 1.98.1, Cargo 1.98.1, Node 22.23.2, OpenSSL 3.5.5 and installed
GNU plus musl Rust targets. Go was not installed. `/run/user/1000` was mode 0700,
which rules out placing a cross-user gateway socket there without weakening that
boundary. Fleetrepo already manages Rust stable, Node, linger and systemd-oriented
Alder convergence. `getent passwd` found `jari` (UID 1000) and no `kaisa`
account; ADR 0003 therefore makes the exact Fleetrepo account declaration part of
the pilot review rather than pretending the second socket can already start.
These are dated observations, not future prerequisites by fiat.

## Primary upstream inputs

The following primary pages returned HTTP 200 on 2026-09-22 and were used for
the proposal:

- Axum 0.8.9 docs: `https://docs.rs/axum/0.8.9/axum/`
- Tokio 1.53.1 Unix stream docs:
  `https://docs.rs/tokio/1.53.1/tokio/net/struct.UnixStream.html`
- rustls 0.23.45 docs: `https://docs.rs/rustls/0.23.45/rustls/`
- openidconnect 4.0.1 docs:
  `https://docs.rs/openidconnect/4.0.1/openidconnect/`
- systemd socket and execution manuals:
  `https://www.freedesktop.org/software/systemd/man/latest/systemd.socket.html`
  and `systemd.exec.html`
- OpenID Connect Core 1.0:
  `https://openid.net/specs/openid-connect-core-1_0.html`

Crates.io reported these exact versions, licenses and package checksums:

| package | version | license | crates.io SHA-256 |
|---|---:|---|---|
| axum | 0.8.9 | MIT | `31b698c5f9a010f6573133b09e0de5408834d0c82f8d7475a89fc1867a71cd90` |
| tokio | 1.53.1 | MIT | `202caea871b69668250d242070849eb495be178ed697a3e98aebce5bc81a0bed` |
| rustls | 0.23.45 | Apache-2.0 OR ISC OR MIT | `0d41d731c7d2f962d1ccc364cec258de3c0e93b38c2fb3ba97ac74513048d634` |
| openidconnect | 4.0.1 | MIT | `0d8c6709ba2ea764bbed26bce1adf3c10517113ddea6f2d4196e4851757ef2b2` |
| tower-http | 0.7.1 | MIT | `08a05a66a4fdd61cbbe0a1d755ffe0ca6aba159dd4820936a0ff8a8278245b9c` |
| libc (probe only) | 0.2.189 | MIT OR Apache-2.0 | `3eaf3ede3fee6db1a4c2ee091bf8a8b4dccdc6d17f656fb07896ee72867612f2` |

The matching upstream tag observations were Axum tag object
`31872e2e543b9cbb0e671ca7d678448b38cfb4c7` peeled to
`c59208c86fded335cd85e388030ad59347b0e5ae`, Tokio
`75fef53d0a8590c2d1dbb63672aa7b7d1ef51155`, rustls
`2976d90fd1c2db6b518700dd101b714069cfcb17`, openidconnect
`b639b5d39eac6903238867aeb2b29326502e6b26`, and tower-http
`c9414514a421b07b6520e040a3fd6a579b0c5e1b`. A tag reference is supply-chain
provenance, not an independent security audit.

For comparison, the current public package observations were Go OAuth2 v0.37.0,
go-oidc v3.21.0, Fastify 5.12.5 (MIT), openid-client 6.8.8 (MIT) and
`@fastify/static` 10.1.4 (MIT). They establish viable alternatives; they were not
installed or executed.

## Option assessment

| Lens | Rust gateway + daemon | Go gateway + daemon | TypeScript/Node gateway + daemon | split languages |
|---|---|---|---|---|
| Least privilege / Unix primitives | Strong direct fit; explicit peer credentials and process ownership, memory-safe without GC | Strong direct fit; would need a new managed toolchain and `x/sys` for some Linux details | Feasible, but native credential/process edges and runtime package boundary are less direct | No privilege benefit by itself |
| Packaging / rollback | One musl artifact plus static assets; Rust/musl already managed on Alder | Excellent static artifact, but Go absent on target | Node runtime and production dependency tree become release inputs | At least two release and vulnerability paths |
| Maintainability | One language and contract model; compile-time ownership helps long-lived child/event state | Simpler language and strong standard HTTP library | Shares frontend syntax, not state or authority; async/process correctness remains separate | Highest integration burden |
| Runtime resources | No GC; expected small steady services, still must measure | Small baseline with GC, likely acceptable | One V8 runtime per daemon plus gateway; must measure | Multiplicative |
| Operations | Fits Cargo/cargo-dist/Fleetrepo conventions | Requires a new fleet package/toolchain contract | Node is installed, but ADR 0002 makes it build-time only | More checks and rollback combinations |
| Testability | Strong unit/property/integration tooling; static fixture succeeded | Strong | Strong HTTP testing, weaker reason to choose at the Linux edge | Cross-language fixtures required |

Rust wins narrowly because it minimizes the **deployed** stack on this host and
fits the highest-risk Linux/process boundary. Go remains the credible fallback
if a walking slice demonstrates materially lower complexity or resource use.
Node remains the frontend builder. No evidence justifies a split gateway/daemon
language.

## Disposable experiment

`experiment/` contains a Rust 2024 probe with a committed lockfile. It creates a
mode-0660 Unix socket, reads the accepted connection's Linux `SO_PEERCRED`, and
allows or denies one HTTP health request by configured UID. `probe.py` builds to
a temporary target outside the repository, exercises allow and deny cases,
builds musl, records artifact facts and removes the target.

Reproduce from the repository root:

```sh
cargo generate-lockfile --manifest-path issues/choose-host-stack/experiment/Cargo.toml
python3 issues/choose-host-stack/experiment/probe.py \
  > issues/choose-host-stack/experiment/evidence.json
```

Observed result:

- matching UID 1000: HTTP `200 OK`;
- intentionally expected UID 1001: HTTP `403 Forbidden`;
- socket mode: `0660` in both cases;
- musl release artifact: 594,032 bytes, unstripped x86-64 static PIE;
- `ldd`: `statically linked`;
- all temporary build and socket paths removed.

This proves only that the selected toolchain can emit a static artifact and that
Linux exposes a usable peer-UID check. Both clients actually ran as UID 1000; the
deny case changed the expected UID. It does **not** prove cross-user isolation,
systemd template expansion/socket ownership, Axum over socket activation, OIDC,
SSE backpressure, Pi lifecycle or production resource use. Those are explicit
pre-acceptance/implementation tests in ADR 0003.

A disposable systemd hardening check was also run against a temporary gateway
service using `systemd-analyze security --offline=yes`. systemd 259 rated the
sample exposure `3.4 OK`; it warned that the test-only `nobody` identity is
unsafe and that the default umask was too broad. The proposal therefore uses a
fixed dedicated gateway account and an explicit strict umask. This score is a
lint signal, not a security proof, and the final installed unit must be checked
again byte-for-byte.

The host denied unprivileged `unshare --user --map-root-user`; therefore no
local user-namespace substitute is treated as a two-user test. The proposed
systemd VM fixture is required rather than weakening or pretending that check.

## Exact commands run and outcomes

Successful evidence commands included:

```sh
taskfleet version --output json                 # 0.11.0, expected skill version
hostname -s                                     # alder
systemctl --version                             # systemd 259
rustc --version                                 # 1.98.1
cargo --version                                 # 1.98.1
rustup target list --installed                  # GNU and musl x86-64 targets
node --version                                  # v22.23.2
go version                                      # command absent; recorded alternative cost
stat -c '%a %U %G %n' /run /run/user /run/user/$(id -u)
git ls-remote --tags <upstream> <exact-tag>      # revisions recorded above
python3 issues/choose-host-stack/experiment/probe.py
```

No command contacted a live product service or mutated persistent machine state.
Network reads were limited to public package metadata, primary docs and Git tags.

## Failure and tool inventory

No required command or workflow remains failed or incomplete.

Optional evidence attempts and their bounded outcomes:

1. The first crates.io metadata script assumed `license` was in the crate summary
   and exited with `KeyError`. A corrected query read the version object and
   recorded all selected licenses/checksums.
2. The first combined `git ls-remote` loop mishandled tag arguments containing a
   slash and omitted/misaligned some output. Separate exact repository/tag calls
   succeeded and are the only revisions reported above.
3. Grep pipelines against large upstream HTML caused curl exit 23 after grep
   closed its pipe on the first match. Direct bounded HTTP reads then returned
   200 for every primary page; no content claim depends on the failed pipeline.
4. `systemd-analyze security --offline=yes /dev/stdin` rejected `/dev/stdin` as a
   filename. A real temporary service file succeeded. The warning and score are
   recorded above.
5. Unprivileged user namespaces were unavailable (`uid_map: Operation not
   permitted`). This was an optional local convenience, not the required
   two-user proof; the ADR requires a disposable systemd VM.

The optional failures changed no machine or repository state and were resolved
where they supplied evidence. There was no panel: deterministic repository,
upstream, kernel and packaging evidence resolved the language/topology choice,
so multiplying opinion did not address a genuine tie.

A critical evidence-gated `/llm-review` used `claude-fable-5-1` as finder and
`gpt-6-astra` as independent verifier because authentication, Unix routing,
process ownership and deployment are high-risk boundaries. Local verification
used the systemd 259 manuals, current account/tool environment, Fleetrepo policy
and focused shell/checksum checks. `/assess-findings` classified eleven concrete
design findings as five `FIX` and six `FIX_WITH_CARE`; all were corrected in this
delivery. The corrections replace unsafe nested SSH quoting with stdin scripts,
separate gateway and daemon filesystem policy, define graceful child shutdown,
add a gateway-identity admin socket, specify the daemon's native environment and
OIDC egress, make the missing second account explicit, quiesce socket activation,
separate aggregate health from operator readiness, run detailed checks in the
service context and fix checksum working-directory semantics. Review and
assessment artifacts are preserved under ignored `history/`; no finding requires
a separate issue.

## Remaining proof and review gate

Before ADR acceptance or Alder mutation, `review-implementation-plan` must review
all items named in ADR 0003, especially the OIDC provider/mappings, session
expiry, unit bytes, fixed gateway UID, socket modes, daemon restart semantics,
Fleetrepo declaration, update gate, rollback and reset list. Implementation must
then prove:

- two real synthetic UIDs with positive and cross-user negative tests;
- OIDC callback, issuer/audience/nonce/PKCE/state/session/CSRF/logout behavior;
- peer UID checks under actual systemd socket activation;
- gateway denial of home access and absence of native credentials in its views;
- one-writer Pi ownership, browser loss, daemon crash/restart and history
  settlement;
- terminal read-only/transfer and Taskfleet ownership boundaries;
- SSE cursor/resnapshot and uncertain command IDs;
- resource use and long-history behavior; and
- Fleetrepo install, no-op reapply, update, failed update, rollback and complete
  pilot reset.

Alder is the authorized future target only after those commands are implemented,
accepted and executable. This decision performed no deployment.
