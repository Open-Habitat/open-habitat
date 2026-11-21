# Result: one Microsoft process per person, five areas and the permission hook

Implements ADR 0039 together with `agent-account-instructions-clarity`
(research recommendations 1–4). Shipped as the default, without an
experimental flag: it replaces behaviour that multiplied Microsoft processes
per conversation and put mailbox administration into file searches, and an
upgrade migrates every account itself.

## What was built

- **One child, owned by the daemon** (`internal/msmcp`). The integrations
  catalog starts `msmcp.Server` for the daemon's lifetime. It starts the
  pinned native stdio server only when a request needs it, stops it after
  10 minutes with nothing in flight, and reaps it before any replacement.
  Requests of the running binding share the child; another binding (a second
  account, or the same account at a new level or application) waits while
  the running calls drain (at most 2 minutes), then the child is stopped,
  reaped and the next one started. Queue (64) and per-connection requests
  (32) are bounded. Ids and progress tokens are rewritten per client and
  mapped back; a client's cancellation removes a queued call or reaches the
  native server for a sent one; a closed connection cancels what it still
  had in flight. A child that dies fails its in-flight calls with “outcome
  unknown, not repeated”; nothing is ever sent again.
- **Private endpoint.** `~/.local/state/open-habitat/mcp/microsoft.sock`,
  directory 0700 and socket 0600, both created through held directory
  descriptors without following symlinks; every accepted connection's
  SO_PEERCRED UID must equal the daemon's, and the relay checks the
  listener's UID the same way. A lock file lets only one daemon of a person
  serve (an overlap during a restart waits). No TCP, no gateway or broker
  route, no credential: the native token cache stays authoritative.
- **Relay** `open-habitat mcp-relay microsoft --account A --area X`: copies
  stdio, nothing else. With nothing listening it starts the person's daemon
  once through the socket-activated agent socket (a Pi started over SSH).
- **Binding from the daemon's own records.** The five area entries carry the
  account's native environment (as the single entry did) plus
  `OH_MICROSOFT_ALLOWED_SCOPES`; the daemon builds the native command from
  them, requires all five to agree, the cache path and identity pin to be the
  account's own, and the scopes to be known ones. A relay's hello names only
  account and area; an unknown account gets an error and starts nothing.
- **Five area entries** `ms-mail`, `ms-calendar`, `ms-contacts`, `ms-files`,
  `ms-admin` (`ms2-…` for the next account), each with a description naming
  the address and what the area is for, and the six sign-in tools hidden.
  The daemon serves each only its area's tools, at the level the native
  server offers; sign-in tools are in no area and cannot be called.
- **Migration.** An earlier single entry (readable, suffixed or hex name)
  that is current in what it allows is rewritten into the five areas in one
  atomic `mcp.json` write, keeping its own client, tenant and scopes: no
  sign-in, no tenant request, no Pi command. A single entry from before the
  file tools still asks the tenant first, as before. Registration and removal
  now write `mcp.json` directly instead of `pi mcp add/remove`.
- **Agent text.** The account section names the five areas, says to pick one
  first (`describeNamespace("ms-files")`, `searchTools(query, {namespace:
  "ms-files"})`, a mail folder is not a file folder) and that deleting,
  sending and sharing a calendar ask the person.
- **Permission hook** (`internal/daemon/microsoft-permission.mjs`), loaded
  into every browser conversation's Pi beside the companion. Before the 19
  calls (every delete, send, reply, forward, meeting cancellation, calendar
  sharing grant or change) it asks through the typed permission question:
  the action in plain Finnish, the account, the consequence with names and
  counts from one read through the same account's relay (5 s), falling back
  to the ID, and the technical call. Without a browser (`ctx.hasUI` false) it
  blocks with the companion's reason and looks nothing up.

## Footprint (four conversations)

`TestMicrosoftFootprintLab`: production `msmcp.Server` (hosted by the test
binary as the daemon hosts it), the real pinned server, the built relay, four
real Pi 1.5.2 conversations; synthetic account, not signed in (the lab alone
drops the identity pin, which exits at start for an account missing from
the cache). MiB, after a 3 s settle; evidence in
`/var/tmp/agent-keep/microsoft-single-process-per-person/`.

| Conversations | Native (RSS/PSS) | Relays (n, RSS/PSS) | Endpoint in daemon | **MCP side (RSS/PSS)** | Pi, separately (RSS/PSS) |
|---:|---:|---:|---:|---:|---:|
| 1 | 163 / 160 | 5, 108 / 57 | 7.0 | **278 / 224** | 107 / 67 |
| 2 | 163 / 160 | 10, 214 / 101 | 6.9 | **384 / 268** | 215 / 132 |
| 3 | 128 / 125 | 15, 322 / 145 | 6.9 | **456 / 276** | 306 / 179 |
| 4 | 128 / 125 | 20, 428 / 189 | 8.5 | **565 / 322** | 396 / 225 |

One native process at every step. The relays dominate: each is the whole
product binary, whose package initialisation keeps about 9 MiB of live heap
(about 22 MiB RSS, 11 MiB PSS per relay with the binary's pages shared).
A relay built from `msmcp.Relay` alone measured 4.8 MiB RSS / 3.6 MiB PSS
(not shipped); twenty of those would cut roughly 350 MiB RSS / 120 MiB PSS
at four conversations. Before this change one Microsoft account cost about
185 MiB per open conversation (740 MiB at four), and five areas without
sharing would have cost about 750 MiB per conversation.

## Decisions for later review

- **Relay in the product binary despite its weight.** The issue asks for the
  relay in the product binary; a second, minimal relay binary is a release
  packaging change. Alternatives: a minimal `open-habitat-mcp-relay` binary
  in the release (numbers above), or trimming package-level initialisation.
  Proposed as a follow-up.
- **Endpoint in the home, not `/run`.** The daemon cannot create files in its
  root-owned socket directory, and `/run/user/<uid>` exists only while the
  person lingers; SSH-started Pi sessions need the same path. Alternatives:
  a systemd socket unit per person (host template change), or the agent
  socket (its 64 slots and deadlines suit short requests, not twenty
  long-lived streams).
- **The 19 calls include sending.** Jari's direction named deletions and
  calendar sharing; the research's confirmation set, which the brief named
  (“the 19”), also covers send, reply, forward and cancelling a meeting,
  which reach another person at once. Dropping those is a one-line change in
  `guardedTools`.
- **Questions in Finnish.** The browser is Finnish; the prototype's wording
  (“Poista postikansio ’Laskut 2024’”) is followed.
- **Binding carried in the entries' env** (plus `OH_MICROSOFT_ALLOWED_SCOPES`),
  read by the daemon and ignored by the relay, rather than a new Habitat
  store: `mcp.json` was already the registration's record.
- **Pi sessions the person starts themselves get the areas but not the
  hook**, as they load no Habitat extension; Pi workers started by an agent
  likewise. Before this change neither had any confirmation.
- **Answering Pi's newer protocol request with the native server's
  revision** (2025-06-18) instead of echoing an unknown one.
- **Login, import and status one-shots** (`--list-accounts`, `verify`)
  still run the native binary briefly as before; they are commands that
  exit, not MCP servers.
- **Agent text** for the account changed (areas paragraph); like the search
  text it should be proofread by Jari before it reaches the pilots.

## Checks run

- `./scripts/test-focused.sh --area go --go-package ./internal/msmcp`, and
  `go test -race -count=8 ./internal/msmcp` (short private TMPDIR): pass.
- `./scripts/test-focused.sh --area go --go-package ./internal/daemon/integrations`: pass.
- `OH_TEST_MICROSOFT_RUNTIME=<installed runtime> go test -run TestMicrosoftMCPToolsPinnedServer`:
  pass, including every offered tool being in an area at every level.
- `./scripts/test-focused.sh --area go --go-package ./internal/daemon` (full
  package, 225 s): pass. `--go-package ./internal/cli`: pass.
- `node --test internal/daemon/pi-device-test/microsoft-permission.test.mjs`
  and `permission.test.mjs`: pass.
- `scripts/validate-project-view.py`: valid. No contract, web or browser
  change; no browser spec touched.
- The live test-server check (agent finds a SharePoint file; a deletion asks
  in the composer's place) waits for the release; it is a KOKEILTAVAA item.

## Review

Critical rigor (daemon state, a Unix-user boundary and a permission gate):
an independent `/llm-review` with gpt-6-astra as finder and claude-fable-5-2
as verifier (two calls), then `/assess-findings`. Seven findings, all
confirmed by local reading and by the verifier, all fixed in this branch:

- an answer over the line bound left the child blocked writing and the slot
  waiting forever for its reap (now the reader closes the output and stops
  the child; `TestOversizedAnswerDoesNotWedgeTheSlot`);
- a child starting during shutdown was awaited, not stopped
  (`TestShutdownStopsAStartingChild`);
- a cancelled or disconnected request could be admitted between check and
  queue (now checked under the slot's lock; `TestGoneClientIsNotAdmitted`);
- calls queued while their account was removed or changed level ran under the
  old binding (now failed; `TestQueuedCallsDoNotOutliveTheirBinding`);
- repair under a kept prefix could overwrite another entry with an area's
  name (`TestMicrosoftRegisterKeepsForeignEntryUnderItsPrefix`);
- a stale drain deadline and a slot leak on a cancel/answer race (rare,
  one-line fixes kept).

After the fixes: `go test -race -count=4 ./internal/msmcp` and the
integrations package passed again.

## Not done

- Research recommendation 5 (asking Pi upstream for tool groups on one
  connection and declarative confirmation) is a publication outside this
  repository; not done here.
- Foreign-UID denial is tested by replacing the accepted peer's UID; an
  unprivileged test cannot connect as another kernel UID. The directory's
  0700 mode is what other accounts meet on a host.
